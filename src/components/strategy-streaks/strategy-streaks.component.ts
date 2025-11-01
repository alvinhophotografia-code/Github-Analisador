
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StrategyService } from '../../services/strategy.service';
import { Strategy } from '../../types';
import { UiLayoutService } from '../../services/ui-layout.service';

@Component({
  selector: 'app-strategy-streaks',
  templateUrl: './strategy-streaks.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class StrategyStreaksComponent {
  strategyService = inject(StrategyService);
  private uiLayoutService = inject(UiLayoutService);

  title = input<string>('Sequências das Estratégias');
  filter = input<'all' | 'priority' | 'active'>('all');
  layoutKey = input.required<string>();
  
  isCardMinimized = computed(() => this.uiLayoutService.isMinimized(this.layoutKey())());

  minimizedStates = computed(() => {
    const layoutState = this.uiLayoutService.state$();
    const itemStates: Record<string, boolean> = {};
    for (const key in layoutState) {
      if (key.startsWith('strategyStreaksItems.')) {
        const strategyId = key.split('.')[1];
        if (strategyId) {
          itemStates[strategyId] = layoutState[key];
        }
      }
    }
    return itemStates;
  });

  private strategies = this.strategyService.strategies;

  filteredStrategies = computed(() => {
    const allStrategies = this.strategies();
    if (this.filter() === 'priority') {
      return allStrategies.filter(s => s.isPriority && s.active);
    }
    if (this.filter() === 'active') {
      return allStrategies.filter(s => s.active);
    }
    return allStrategies;
  });

  hitRate(strategy: Strategy): string {
    const losses = (strategy as any).losses ?? (strategy as any).misses ?? 0;
    const total = strategy.hits + losses;
    return total > 0 ? ((strategy.hits / total) * 100).toFixed(1) + '%' : 'N/A';
  }
  
  toggleCardMinimized(): void {
    this.uiLayoutService.toggleMinimized(this.layoutKey());
  }

  toggleMinimized(strategyId: string): void {
    this.uiLayoutService.toggleMinimized(`strategyStreaksItems.${strategyId}`);
  }

  generateSparklinePath(strategy: Strategy): string {
    const history = strategy.history.slice(0, 20).reverse(); // Last 20, oldest to newest
    if (history.length < 2) return '';

    const width = 100;
    const height = 20;
    const padding = 2;
    
    const points = history.map((h, i) => ({
      x: (i / (history.length - 1)) * width,
      y: (h.result === 'hit' ? padding : height - padding)
    }));

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x},${points[i].y}`;
    }
    return path;
  }
}