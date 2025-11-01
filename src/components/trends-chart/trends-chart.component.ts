import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, effect, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouletteService } from '../../services/roulette.service';
import { getNumberColor, getNumberParity } from '../../utils';
import { UiLayoutService } from '../../services/ui-layout.service';

declare var d3: any;

interface TrendPoint {
  spin: number;
  redPercent: number;
  blackPercent: number;
  evenPercent: number;
  oddPercent: number;
}

@Component({
  selector: 'app-trends-chart',
  template: `
    <div class="glass-card p-4">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-lg font-semibold text-primary">Tendências de Cor & Paridade</h3>
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
            @if (rouletteService.results().length >= 20) {
              <div #chartContainer class="w-full h-64 relative"></div>
            } @else {
              <div class="w-full h-64 flex items-center justify-center">
                  <p class="text-muted-foreground text-sm">Dados insuficientes para tendências (mínimo 20 jogadas).</p>
              </div>
            }
        </div>
       }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class TrendsChartComponent {
  rouletteService = inject(RouletteService);
  private uiLayoutService = inject(UiLayoutService);
  chartContainer = viewChild<ElementRef<HTMLDivElement>>('chartContainer');
  isMinimized = this.uiLayoutService.isMinimized('trendsChart');
  
  private svg: any;
  private x: any;
  private y: any;
  private xAxis: any;
  private yAxis: any;
  private tooltip: any;
  private width!: number;
  private height!: number;
  private margin = { top: 20, right: 20, bottom: 30, left: 40 };

  trendsData = computed(() => {
    const results = this.rouletteService.results().slice().reverse(); // oldest to newest
    if (results.length < 1) return []; // Allow chart to show with at least 1 point

    const data: TrendPoint[] = [];
    let redCount = 0, blackCount = 0, evenCount = 0, oddCount = 0;

    for (let i = 0; i < results.length; i++) {
      const num = results[i];
      if (getNumberColor(num) === 'red') redCount++;
      if (getNumberColor(num) === 'black') blackCount++;
      if (getNumberParity(num) === 'even') evenCount++;
      if (getNumberParity(num) === 'odd') oddCount++;

      const totalSpins = i + 1;
      const totalNonZero = totalSpins - (results.slice(0, totalSpins).filter(n => n === 0).length);

      data.push({
        spin: totalSpins,
        redPercent: totalSpins > 0 ? (redCount / totalSpins) * 100 : 0,
        blackPercent: totalSpins > 0 ? (blackCount / totalSpins) * 100 : 0,
        evenPercent: totalNonZero > 0 ? (evenCount / totalNonZero) * 100 : 0,
        oddPercent: totalNonZero > 0 ? (oddCount / totalNonZero) * 100 : 0,
      });
    }
    return data;
  });

  constructor() {
    afterNextRender(() => {
        if (this.rouletteService.results().length >= 20 && !this.isMinimized()) {
            this.initChart();
            this.updateChart();
        }
    });

    effect(() => {
      const container = this.chartContainer();
      if (container && this.rouletteService.results().length >= 20 && !this.isMinimized()) {
        if (!this.svg) {
          this.initChart();
        }
        this.updateChart();
      }
    });
  }

  toggleMinimized(): void {
    this.uiLayoutService.toggleMinimized('trendsChart');
  }

  private initChart(): void {
    const container = this.chartContainer()?.nativeElement;
    if (!container) return;

    d3.select(container).selectAll("*").remove(); // Clean up on re-init

    this.width = container.clientWidth - this.margin.left - this.margin.right;
    this.height = container.clientHeight - this.margin.top - this.margin.bottom;
    
    this.svg = d3.select(container)
      .append("svg")
      .attr("width", this.width + this.margin.left + this.margin.right)
      .attr("height", this.height + this.margin.top + this.margin.bottom)
      .append("g")
      .attr("transform", `translate(${this.margin.left},${this.margin.top})`);
      
    this.x = d3.scaleLinear().range([0, this.width]);
    this.y = d3.scaleLinear().domain([0, 100]).range([this.height, 0]);

    this.xAxis = this.svg.append("g")
      .attr("transform", `translate(0,${this.height})`);
      
    this.yAxis = this.svg.append("g")
      .call(d3.axisLeft(this.y).ticks(5).tickFormat((d: any) => d + '%'))
      .selectAll("text").style("fill", "hsl(var(--muted-foreground))");
      
    // Add paths for lines
    this.svg.append("path").attr("class", "line red-line");
    this.svg.append("path").attr("class", "line black-line");
    this.svg.append("path").attr("class", "line even-line");
    
    this.setupTooltip();
  }
  
  private updateChart(): void {
    if (!this.svg) return;
    
    const data = this.trendsData();
    const blackLineColor = 'hsl(0, 0%, 75%)';

    // Update domain
    this.x.domain(d3.extent(data, (d: TrendPoint) => d.spin));

    // Update axes
    this.xAxis.transition().duration(300)
      .call(d3.axisBottom(this.x).ticks(5))
      .selectAll("text").style("fill", "hsl(var(--muted-foreground))");

    const lineGenerator = (yValue: (d: TrendPoint) => number) => d3.line()
        .x((d: any) => this.x(d.spin))
        .y((d: any) => this.y(yValue(d)));
        
    // Update lines
    this.svg.select(".red-line")
        .datum(data)
        .transition().duration(300)
        .attr("fill", "none")
        .attr("stroke", "hsl(var(--roulette-red))")
        .attr("stroke-width", 2)
        .attr("d", lineGenerator(d => d.redPercent));
    
    this.svg.select(".black-line")
        .datum(data)
        .transition().duration(300)
        .attr("fill", "none")
        .attr("stroke", blackLineColor)
        .attr("stroke-width", 2)
        .attr("d", lineGenerator(d => d.blackPercent));
      
    this.svg.select(".even-line")
        .datum(data)
        .transition().duration(300)
        .attr("fill", "none")
        .attr("stroke", "hsl(var(--foreground))")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", ("3, 3"))
        .attr("d", lineGenerator(d => d.evenPercent));
        
    this.updateTooltip(data, blackLineColor);
  }
  
  private setupTooltip(): void {
    this.tooltip = d3.select(this.chartContainer()?.nativeElement)
      .append("div")
      .attr("class", "d3-tooltip");

    const focus = this.svg.append("g")
      .attr("class", "focus")
      .style("display", "none");

    focus.append("line").attr("class", "x-hover-line hover-line").attr("y1", 0).attr("y2", this.height).style("stroke", "hsl(var(--primary))").style("stroke-width", "1px").style("stroke-dasharray", "3,3");
    
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
  
  private updateTooltip(data: TrendPoint[], blackLineColor: string): void {
     this.svg.select('.overlay').on('mousemove', (event: MouseEvent) => this.mousemove(event));
  }
  
  private mousemove(event: MouseEvent) {
    const data = this.trendsData();
    const blackLineColor = 'hsl(0, 0%, 75%)';

    const x0 = this.x.invert(d3.pointer(event)[0]);
    const bisector = d3.bisector((d: TrendPoint) => d.spin).left;
    const i = bisector(data, x0, 1);
    const d0 = data[i - 1];
    const d1 = data[i];
    if (!d0 || !d1) return;

    const d = (x0 - d0.spin > d1.spin - x0) ? d1 : d0;
    
    this.svg.select(".focus").attr("transform", `translate(${this.x(d.spin)},0)`);
    
    this.tooltip.html(`
      Jogada: <strong>${d.spin}</strong><br/>
      <span style="color:hsl(var(--roulette-red))">Vermelho: ${d.redPercent.toFixed(1)}%</span><br/>
      <span style="color:${blackLineColor}">Preto: ${d.blackPercent.toFixed(1)}%</span><br/>
      <span style="color:hsl(var(--foreground))">Par: ${d.evenPercent.toFixed(1)}%</span>
    `)
      .style("left", (event.pageX + 15) + "px")
      .style("top", (event.pageY - 28) + "px");
  }
}
