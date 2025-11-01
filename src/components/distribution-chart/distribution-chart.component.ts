
import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, effect, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouletteService } from '../../services/roulette.service';
import { getNumberColor } from '../../utils';
import { UiLayoutService } from '../../services/ui-layout.service';

declare var d3: any;

interface NumberFrequency {
  number: number;
  count: number;
}

@Component({
  selector: 'app-distribution-chart',
  template: `
    <div class="glass-card p-4">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-lg font-semibold text-primary">Distribuição de Números</h3>
        <button (click)="toggleMinimized()" class="p-1 text-muted-foreground hover:text-foreground">
          @if(!isMinimized()) {
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          }
        </button>
      </div>

      @if(!isMinimized()) {
        <div class="animate-slide-in">
          @if (rouletteService.results().length >= 10) {
            <div #chartContainer class="w-full h-64 relative"></div>
          } @else {
            <div class="w-full h-64 flex items-center justify-center">
                <p class="text-muted-foreground text-sm">Dados insuficientes para mostrar o gráfico (mínimo 10 jogadas).</p>
            </div>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class DistributionChartComponent {
  rouletteService = inject(RouletteService);
  private uiLayoutService = inject(UiLayoutService);
  chartContainer = viewChild<ElementRef<HTMLDivElement>>('chartContainer');
  isMinimized = this.uiLayoutService.isMinimized('distributionChart');

  private svg: any;
  private x: any;
  private y: any;
  private xAxis: any;
  private yAxis: any;
  private tooltip: any;
  private width!: number;
  private height!: number;
  private margin = { top: 20, right: 0, bottom: 30, left: 30 };

  frequencies = computed(() => {
    const results = this.rouletteService.results();
    const counts = new Map<number, number>();
    for (let i = 0; i <= 36; i++) {
      counts.set(i, 0);
    }
    results.forEach(num => {
      counts.set(num, (counts.get(num) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([number, count]) => ({ number, count }));
  });

  constructor() {
    afterNextRender(() => {
       if (this.rouletteService.results().length >= 10 && !this.isMinimized()) {
         this.initChart();
         this.updateChart();
       }
    });

    effect(() => {
      const container = this.chartContainer();
      if (container && this.rouletteService.results().length >= 10 && !this.isMinimized()) {
         if (!this.svg) {
           this.initChart();
         }
         this.updateChart();
      }
    });
  }

  toggleMinimized(): void {
    this.uiLayoutService.toggleMinimized('distributionChart');
  }
  
  private initChart(): void {
    const container = this.chartContainer()?.nativeElement;
    if (!container) return;
    
    this.width = container.clientWidth - this.margin.left - this.margin.right;
    this.height = container.clientHeight - this.margin.top - this.margin.bottom;

    this.svg = d3.select(container)
      .append("svg")
      .attr("width", this.width + this.margin.left + this.margin.right)
      .attr("height", this.height + this.margin.top + this.margin.bottom)
      .append("g")
      .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

    this.tooltip = d3.select(container)
      .append("div")
      .attr("class", "d3-tooltip");
      
    this.x = d3.scaleBand().range([0, this.width]).padding(0.2);
    this.y = d3.scaleLinear().range([this.height, 0]);
    
    this.xAxis = this.svg.append("g")
      .attr("transform", `translate(0,${this.height})`);
      
    this.yAxis = this.svg.append("g");
  }

  private updateChart(): void {
    if (!this.svg) return;

    const data = this.frequencies();

    // Update domains
    this.x.domain(data.map(d => d.number));
    this.y.domain([0, d3.max(data, (d: NumberFrequency) => d.count)]);
    
    // Update axes
    this.xAxis.transition().duration(300)
      .call(d3.axisBottom(this.x).tickValues(this.x.domain().filter((d: any,i: number) => !(i%5))))
      .selectAll("text").style("fill", "hsl(var(--muted-foreground))");
      
    this.yAxis.transition().duration(300)
      .call(d3.axisLeft(this.y).ticks(5))
      .selectAll("text").style("fill", "hsl(var(--muted-foreground))");

    // Data join
    const bars = this.svg.selectAll("rect")
      .data(data, (d: NumberFrequency) => d.number);

    bars.join(
      (enter: any) => enter.append("rect")
          .attr("x", (d: NumberFrequency) => this.x(d.number))
          .attr("y", this.height)
          .attr("width", this.x.bandwidth())
          .attr("height", 0)
          .attr("fill", (d: NumberFrequency) => {
              const color = getNumberColor(d.number);
              if (color === 'red') return 'hsl(var(--roulette-red))';
              if (color === 'black') return 'hsl(var(--roulette-black))';
              return 'hsl(var(--roulette-green))';
          })
          .on("mouseover", (event: MouseEvent, d: NumberFrequency) => {
            this.tooltip.transition().duration(200).style("opacity", .9);
            this.tooltip.html(`Número: <strong>${d.number}</strong><br/>Contagem: <strong>${d.count}</strong>`)
              .style("left", (event.pageX + 5) + "px")
              .style("top", (event.pageY - 28) + "px");
          })
          .on("mouseout", () => {
            this.tooltip.transition().duration(500).style("opacity", 0);
          })
        .call((enter: any) => enter.transition().duration(300)
          .attr("y", (d: NumberFrequency) => this.y(d.count))
          .attr("height", (d: NumberFrequency) => this.height - this.y(d.count))),
      (update: any) => update
        .call((update: any) => update.transition().duration(300)
          .attr("y", (d: NumberFrequency) => this.y(d.count))
          .attr("height", (d: NumberFrequency) => this.height - this.y(d.count))),
      (exit: any) => exit
        .call((exit: any) => exit.transition().duration(300)
          .attr("y", this.height)
          .attr("height", 0)
          .remove())
    );
  }
}