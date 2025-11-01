import { ChangeDetectionStrategy, Component, inject, signal, computed, afterNextRender, effect, viewChild, ElementRef } from '@angular/core';
import { CommonModule, formatCurrency, formatNumber, formatPercent } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { StrategyService } from '../../services/strategy.service';
import { RouletteService } from '../../services/roulette.service';
import { ToastService } from '../../services/toast.service';
import { UiStateService } from '../../services/ui-state.service';
import { StatsCardComponent } from '../stats-card/stats-card.component';

import { Strategy, BettingSystem, SimulationResult, BankrollDataPoint, SimulationConfig } from '../../types';

declare var d3: any;

@Component({
  selector: 'app-backtest-tab',
  templateUrl: './backtest-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, StatsCardComponent],
  standalone: true
})
export class BacktestTabComponent {
  strategyService = inject(StrategyService);
  rouletteService = inject(RouletteService);
  toastService = inject(ToastService);
  uiStateService = inject(UiStateService);

  // Config signals
  selectedStrategyId = signal<string>('');
  dataSource = signal<'current' | 'generated'>('current');
  generatedSpins = signal(1000);
  initialBankroll = signal(1000);
  baseBet = signal(10);
  bettingSystem = signal<BettingSystem>('flat');
  stopLoss = signal(0);
  takeProfit = signal(0);
  
  // Save/Load signals
  simulationNameToSave = signal('');
  selectedSimulationToLoad = signal<string>('');
  savedSimulations = this.uiStateService.savedSimulations;

  // State signals
  isRunning = signal(false);
  simulationResult = signal<SimulationResult | null>(null);

  strategies = this.strategyService.strategies;
  
  // D3 Chart properties
  chartContainer = viewChild<ElementRef<HTMLDivElement>>('chartContainer');
  private svg: any;
  private x: any;
  private y: any;
  private xAxis: any;
  private yAxis: any;
  private tooltip: any;
  private width!: number;
  private height!: number;
  private margin = { top: 20, right: 20, bottom: 30, left: 60 };

  constructor() {
    effect(() => {
        const result = this.simulationResult();
        if (result && this.chartContainer()) {
            if (!this.svg) {
                this.initChart();
            }
            this.updateChart(result.bankrollHistory);
        }
    });
  }
  
  runSimulation(): void {
    const strategy = this.strategies().find(s => s.id === this.selectedStrategyId());
    if (!strategy) {
      this.toastService.show('Por favor, selecione uma estratégia.', 'warning');
      return;
    }

    this.isRunning.set(true);
    this.simulationResult.set(null); // Clear previous results

    // Use a timeout to allow the UI to update to the loading state
    setTimeout(() => {
      try {
        let results: number[];
        if (this.dataSource() === 'current') {
          results = this.rouletteService.results();
        } else {
          results = this.generateRandomResults(this.generatedSpins());
        }

        if (results.length === 0) {
            this.toastService.show('Não há dados de resultados para executar a simulação.', 'warning');
            this.isRunning.set(false);
            return;
        }

        const result = this.strategyService.runSimulation(
          strategy.sequence,
          results,
          this.initialBankroll(),
          this.baseBet(),
          this.bettingSystem(),
          this.stopLoss(),
          this.takeProfit()
        );
        this.simulationResult.set(result);

      } catch (error) {
        console.error("Simulation Error:", error);
        this.toastService.show('Ocorreu um erro durante a simulação.', 'error');
      } finally {
        this.isRunning.set(false);
      }
    }, 50);
  }

  saveSimulation(): void {
    const name = this.simulationNameToSave().trim();
    if (!name) {
      this.toastService.show('Por favor, dê um nome à sua configuração.', 'warning');
      return;
    }
    if (!this.selectedStrategyId()) {
      this.toastService.show('Selecione uma estratégia antes de salvar.', 'warning');
      return;
    }

    const config: Omit<SimulationConfig, 'id'> = {
      name,
      strategyId: this.selectedStrategyId(),
      dataSource: this.dataSource(),
      generatedSpins: this.generatedSpins(),
      initialBankroll: this.initialBankroll(),
      baseBet: this.baseBet(),
      bettingSystem: this.bettingSystem(),
      stopLoss: this.stopLoss(),
      takeProfit: this.takeProfit(),
    };
    
    this.uiStateService.saveSimulation(config);
    this.toastService.show(`Configuração '${name}' salva.`, 'success');
    this.simulationNameToSave.set('');
  }

  loadSimulation(): void {
    const configId = this.selectedSimulationToLoad();
    const config = this.savedSimulations().find(c => c.id === configId);
    if (!config) {
      this.toastService.show('Configuração não encontrada.', 'error');
      return;
    }

    this.selectedStrategyId.set(config.strategyId);
    this.dataSource.set(config.dataSource);
    this.generatedSpins.set(config.generatedSpins);
    this.initialBankroll.set(config.initialBankroll);
    this.baseBet.set(config.baseBet);
    this.bettingSystem.set(config.bettingSystem);
    this.stopLoss.set(config.stopLoss);
    this.takeProfit.set(config.takeProfit);

    this.toastService.show(`Configuração '${config.name}' carregada.`, 'info');
  }

  deleteSimulation(): void {
    const configId = this.selectedSimulationToLoad();
    const configName = this.savedSimulations().find(c => c.id === configId)?.name;
    if (!configId) {
      this.toastService.show('Nenhuma configuração selecionada para deletar.', 'warning');
      return;
    }
    this.uiStateService.deleteSimulation(configId);
    this.selectedSimulationToLoad.set('');
    this.toastService.show(`Configuração '${configName}' deletada.`, 'success');
  }

  private generateRandomResults(count: number): number[] {
    const maxNumber = this.uiStateService.rouletteType() === 'american' ? 38 : 37;
    const results = Array.from({ length: count }, () => Math.floor(Math.random() * maxNumber));
    // If american, map 37 to the internal representation of 00
    if (this.uiStateService.rouletteType() === 'american') {
      return results.map(n => n === 37 ? 37 : n);
    }
    return results;
  }

  private initChart(): void {
    const container = this.chartContainer()?.nativeElement;
    if (!container) return;

    d3.select(container).selectAll("*").remove();

    this.width = container.clientWidth - this.margin.left - this.margin.right;
    this.height = container.clientHeight - this.margin.top - this.margin.bottom;
    
    this.svg = d3.select(container)
      .append("svg")
      .attr("width", this.width + this.margin.left + this.margin.right)
      .attr("height", this.height + this.margin.top + this.margin.bottom)
      .append("g")
      .attr("transform", `translate(${this.margin.left},${this.margin.top})`);
      
    this.x = d3.scaleLinear().range([0, this.width]);
    this.y = d3.scaleLinear().range([this.height, 0]);

    this.xAxis = this.svg.append("g")
      .attr("transform", `translate(0,${this.height})`);
      
    this.yAxis = this.svg.append("g");
      
    this.svg.append("path").attr("class", "line bankroll-line");
    
    this.setupTooltip();
  }

  private updateChart(data: BankrollDataPoint[]): void {
    if (!this.svg || data.length === 0) return;

    this.x.domain([0, d3.max(data, (d: BankrollDataPoint) => d.spin)]);
    this.y.domain(d3.extent(data, (d: BankrollDataPoint) => d.bankroll));

    this.xAxis.transition().duration(300)
      .call(d3.axisBottom(this.x).ticks(5))
      .selectAll("text").style("fill", "hsl(var(--muted-foreground))");
    
    this.yAxis.transition().duration(300)
      .call(d3.axisLeft(this.y).ticks(5).tickFormat((d: any) => `§${d}`))
      .selectAll("text").style("fill", "hsl(var(--muted-foreground))");
      
    const lineGenerator = d3.line()
      .x((d: any) => this.x(d.spin))
      .y((d: any) => this.y(d.bankroll));
        
    this.svg.select(".bankroll-line")
      .datum(data)
      .transition().duration(300)
      .attr("fill", "none")
      .attr("stroke", "hsl(var(--primary))")
      .attr("stroke-width", 2)
      .attr("d", lineGenerator);
  }
  
  private setupTooltip(): void {
    this.tooltip = d3.select(this.chartContainer()?.nativeElement)
      .append("div")
      .attr("class", "d3-tooltip");

    const focus = this.svg.append("g")
      .attr("class", "focus")
      .style("display", "none");

    focus.append("line").attr("class", "x-hover-line").attr("y1", 0).attr("y2", this.height).style("stroke", "hsl(var(--primary))").style("stroke-width", "1px").style("stroke-dasharray", "3,3");
    focus.append("circle").attr("r", 4).style("fill", "hsl(var(--primary))");
    
    this.svg.append("rect")
      .attr("class", "overlay")
      .attr("width", this.width)
      .attr("height", this.height)
      .style("fill", "none")
      .style("pointer-events", "all")
      .on("mouseover", () => { focus.style("display", null); this.tooltip.style("opacity", .9); })
      .on("mouseout", () => { focus.style("display", "none"); this.tooltip.style("opacity", 0); })
      .on("mousemove", (event: MouseEvent) => this.mousemove(event));
  }
  
  private mousemove(event: MouseEvent) {
    const data = this.simulationResult()?.bankrollHistory;
    if (!data) return;

    const x0 = this.x.invert(d3.pointer(event)[0]);
    const bisector = d3.bisector((d: BankrollDataPoint) => d.spin).left;
    const i = bisector(data, x0, 1);
    const d0 = data[i - 1];
    const d1 = data[i];
    if (!d0 || !d1) return;

    const d = (x0 - d0.spin > d1.spin - x0) ? d1 : d0;
    
    this.svg.select(".focus").attr("transform", `translate(${this.x(d.spin)},${this.y(d.bankroll)})`);
    
    this.tooltip.html(`Jogada: <strong>${d.spin}</strong><br/>Banca: <strong>§${d.bankroll.toFixed(2)}</strong>`)
      .style("left", (event.pageX + 15) + "px")
      .style("top", (event.pageY - 28) + "px");
  }

  formatAsCurrency(value: number): string {
    return '§' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}