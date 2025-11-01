
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouletteService } from '../../services/roulette.service';
import { getNumberColor } from '../../utils';
import { UiLayoutService } from '../../services/ui-layout.service';

@Component({
  selector: 'app-recent-results',
  templateUrl: './recent-results.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class RecentResultsComponent {
  private rouletteService = inject(RouletteService);
  private uiLayoutService = inject(UiLayoutService);
  
  layoutKey = input.required<string>();
  isMinimized = computed(() => this.uiLayoutService.isMinimized(this.layoutKey())());
  
  recentResults = computed(() => this.rouletteService.results().slice(0, 20));
  totalSpins = computed(() => this.rouletteService.stats().totalSpins);

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