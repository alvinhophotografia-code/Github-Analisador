
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouletteService } from '../../services/roulette.service';
import { getNumberColor } from '../../utils';
import { UiLayoutService } from '../../services/ui-layout.service';

interface NumberFrequency {
  number: number;
  count: number;
}

@Component({
  selector: 'app-hot-cold-numbers',
  template: `
    <div class="glass-card p-4">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-lg font-semibold text-primary">Números Quentes & Frios</h3>
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
          @if (frequencies().length > 0 && rouletteService.results().length > 10) {
            <div class="grid grid-cols-2 gap-4">
              <div>
                <h4 class="font-medium text-red-500 mb-2">🔥 Quentes (Top 5)</h4>
                <div class="space-y-1">
                  @for (item of hotNumbers(); track item.number) {
                    <div class="flex items-center justify-between text-sm">
                      <div [class]="'h-6 w-6 flex items-center justify-center rounded-full text-xs font-bold text-white ' + numberColorClass(item.number)">
                        {{ item.number }}
                      </div>
                      <span class="text-muted-foreground">x {{ item.count }}</span>
                    </div>
                  }
                </div>
              </div>
              <div>
                <h4 class="font-medium text-cyan-400 mb-2">❄️ Frios (Top 5)</h4>
                <div class="space-y-1">
                  @for (item of coldNumbers(); track item.number) {
                    <div class="flex items-center justify-between text-sm">
                      <div [class]="'h-6 w-6 flex items-center justify-center rounded-full text-xs font-bold text-white ' + numberColorClass(item.number)">
                        {{ item.number }}
                      </div>
                      <span class="text-muted-foreground">x {{ item.count }}</span>
                    </div>
                  }
                </div>
              </div>
            </div>
          } @else {
            <p class="text-muted-foreground text-sm">Dados insuficientes para determinar números quentes e frios (mínimo 10 jogadas).</p>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class HotColdNumbersComponent {
  rouletteService = inject(RouletteService);
  private uiLayoutService = inject(UiLayoutService);
  isMinimized = this.uiLayoutService.isMinimized('hotColdNumbers');

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

  hotNumbers = computed(() => {
    return [...this.frequencies()].sort((a, b) => b.count - a.count).slice(0, 5);
  });

  coldNumbers = computed(() => {
    // Filter for numbers that have appeared at least once for a more meaningful "cold" list, unless all are 0.
    const appearedNumbers = this.frequencies().filter(f => f.count > 0);
    if (appearedNumbers.length > 5) {
       return appearedNumbers.sort((a, b) => a.count - b.count).slice(0, 5);
    }
    // if not enough numbers appeared, show numbers that have not appeared.
    return [...this.frequencies()].sort((a, b) => a.count - b.count).slice(0, 5);
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
    this.uiLayoutService.toggleMinimized('hotColdNumbers');
  }
}