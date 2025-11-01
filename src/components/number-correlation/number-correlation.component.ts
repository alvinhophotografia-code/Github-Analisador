
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  selector: 'app-number-correlation',
  templateUrl: './number-correlation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class NumberCorrelationComponent {
  rouletteService = inject(RouletteService);
  private uiLayoutService = inject(UiLayoutService);
  allNumbers = Array.from({ length: 37 }, (_, i) => i);
  isMinimized = this.uiLayoutService.isMinimized('numberCorrelation');

  selectedNumber = signal<number | null>(null);

  correlations = computed<Correlation[]>(() => {
    const selected = this.selectedNumber();
    if (selected === null) return [];

    const results = this.rouletteService.results().slice().reverse(); // Oldest to newest
    const followingCounts = new Map<number, number>();
    let totalOccurrences = 0;

    for (let i = 0; i < results.length - 1; i++) {
      if (results[i] === selected) {
        totalOccurrences++;
        const nextNum = results[i + 1];
        followingCounts.set(nextNum, (followingCounts.get(nextNum) || 0) + 1);
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
      .slice(0, 5);
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

  selectNumber(num: number) {
    this.selectedNumber.set(this.selectedNumber() === num ? null : num);
  }
  
  toggleMinimized(): void {
    this.uiLayoutService.toggleMinimized('numberCorrelation');
  }
}