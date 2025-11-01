import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouletteService } from '../../services/roulette.service';
import { getNumberColor } from '../../utils';
import { UiLayoutService } from '../../services/ui-layout.service';

interface Correlation {
  number: number;
  count: number;
  percentage: number;
}

@Component({
  selector: 'app-live-correlation',
  templateUrl: './live-correlation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  standalone: true
})
export class LiveCorrelationComponent {
  rouletteService = inject(RouletteService);
  private uiLayoutService = inject(UiLayoutService);
  
  layoutKey = input.required<string>();
  isMinimized = computed(() => this.uiLayoutService.isMinimized(this.layoutKey())());

  lastNumber = computed(() => this.rouletteService.stats().lastNumber);

  correlations = computed<Correlation[]>(() => {
    const targetNumber = this.lastNumber();
    if (targetNumber === undefined) return [];

    const results = this.rouletteService.results(); // Newest to oldest
    const followingCounts = new Map<number, number>();
    let totalOccurrences = 0;

    // Iterate backwards to go from older to newer entries
    for (let i = results.length - 2; i >= 0; i--) {
        if (results[i + 1] === targetNumber) {
            const followingNumber = results[i];
            followingCounts.set(followingNumber, (followingCounts.get(followingNumber) || 0) + 1);
            totalOccurrences++;
        }
    }

    if (totalOccurrences === 0) return [];

    return Array.from(followingCounts.entries())
      .map(([number, count]) => ({
        number,
        count,
        percentage: (count / totalOccurrences) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  });
  
  numberColorClass(num: number): string {
    const color = getNumberColor(num);
    switch (color) {
      case 'red': return 'roulette-number-red';
      case 'black': return 'roulette-number-black';
      case 'green': return 'roulette-number-green';
      default: return 'bg-gray-500';
    }
  }

  toggleMinimized(): void {
    this.uiLayoutService.toggleMinimized(this.layoutKey());
  }
}
