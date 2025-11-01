import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouletteService } from '../../services/roulette.service';
import { getNumberColumn, getNumberDozen, getNumberRange } from '../../utils';
import { UiLayoutService } from '../../services/ui-layout.service';

interface DueTracker {
  name: string;
  streak: number;
}

@Component({
  selector: 'app-due-analysis',
  templateUrl: './due-analysis.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  standalone: true,
})
export class DueAnalysisComponent {
  rouletteService = inject(RouletteService);
  private uiLayoutService = inject(UiLayoutService);
  isMinimized = this.uiLayoutService.isMinimized('dueAnalysis');

  private streaks = computed(() => {
    const results = this.rouletteService.results();
    if (results.length === 0) {
      return { dozens: [], columns: [], ranges: [] };
    }

    const findStreak = (predicate: (num: number) => boolean) => {
      const streak = results.findIndex(predicate);
      return streak === -1 ? results.length : streak;
    };

    const dozens: DueTracker[] = [
      { name: '1ª Dúzia', streak: findStreak(n => getNumberDozen(n) === 'first') },
      { name: '2ª Dúzia', streak: findStreak(n => getNumberDozen(n) === 'second') },
      { name: '3ª Dúzia', streak: findStreak(n => getNumberDozen(n) === 'third') },
    ];

    const columns: DueTracker[] = [
      { name: '1ª Coluna', streak: findStreak(n => getNumberColumn(n) === 'first') },
      { name: '2ª Coluna', streak: findStreak(n => getNumberColumn(n) === 'second') },
      { name: '3ª Coluna', streak: findStreak(n => getNumberColumn(n) === 'third') },
    ];
    
    const ranges: DueTracker[] = [
        { name: 'Baixo (1-18)', streak: findStreak(n => getNumberRange(n) === 'low') },
        { name: 'Alto (19-36)', streak: findStreak(n => getNumberRange(n) === 'high') },
    ];
    
    return { dozens, columns, ranges };
  });

  dozenStreaks = computed(() => this.streaks().dozens);
  columnStreaks = computed(() => this.streaks().columns);
  rangeStreaks = computed(() => this.streaks().ranges);
  
  maxDozenStreak = computed(() => Math.max(0, ...this.dozenStreaks().map(d => d.streak)));
  maxColumnStreak = computed(() => Math.max(0, ...this.columnStreaks().map(c => c.streak)));
  maxRangeStreak = computed(() => Math.max(0, ...this.rangeStreaks().map(r => r.streak)));

  toggleMinimized(): void {
    this.uiLayoutService.toggleMinimized('dueAnalysis');
  }
}
