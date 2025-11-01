
import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { RouletteService } from '../../services/roulette.service';
import { StrategyService } from '../../services/strategy.service';
import { UiLayoutService } from '../../services/ui-layout.service';
import { GeminiService } from '../../services/gemini.service';
import { ToastService } from '../../services/toast.service';
import { StatsCardComponent } from '../stats-card/stats-card.component';
import { RecentResultsComponent } from '../recent-results/recent-results.component';
import { DueAnalysisComponent } from '../due-analysis/due-analysis.component';
import { Strategy } from '../../types';
import { getNumberColumn, getNumberDozen, getNumberRange } from '../../utils';

interface DueTracker {
  name: string;
  streak: number;
}
@Component({
  selector: 'app-dashboard-tab',
  templateUrl: './dashboard-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, StatsCardComponent, RecentResultsComponent, DueAnalysisComponent]
})
export class DashboardTabComponent {
  rouletteService = inject(RouletteService);
  strategyService = inject(StrategyService);
  geminiService = inject(GeminiService);
  toastService = inject(ToastService);
  uiLayoutService = inject(UiLayoutService);
  
  isStatsMinimized = this.uiLayoutService.isMinimized('dashboardTabStats');
  isSummaryMinimized = this.uiLayoutService.isMinimized('dashboardTabSummary');
  isInsightsMinimized = this.uiLayoutService.isMinimized('dashboardTabInsights');
  
  // Card order and visibility signals
  cards = this.uiLayoutService.dashboardTabCards;
  isCardVisible = (key: string) => this.uiLayoutService.isVisible(key)();


  isLoadingInsights = signal(false);
  insightsResult = signal<string | null>(null);
  
  stats = this.rouletteService.stats;
  strategies = this.strategyService.strategies;
  
  hitRate(strategy: Strategy): string {
    const losses = (strategy as any).losses ?? (strategy as any).misses ?? 0;
    const total = strategy.hits + losses;
    return total > 0 ? ((strategy.hits / total) * 100).toFixed(1) + '%' : 'N/A';
  }
  
  // Duplicated from due-analysis to provide data to Gemini
  private dueStreaks = computed(() => {
    const results = this.rouletteService.results();
    if (results.length === 0) return { dozens: [], columns: [], ranges: [] };

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

  generateInsights(): void {
    this.isLoadingInsights.set(true);
    this.insightsResult.set(null);

    const latestResults = this.rouletteService.results().slice(0, 50);
    const priorityStrategies = this.strategyService.strategies()
        .filter(s => s.isPriority && s.active)
        .map(s => ({ name: s.name, currentLosingStreak: Math.abs(s.currentStreak) }));
    
    const dueData = this.dueStreaks();
    const allDueItems = [...dueData.dozens, ...dueData.columns, ...dueData.ranges];
    const topDueItems = allDueItems.sort((a,b) => b.streak - a.streak).slice(0, 5);

    this.geminiService.generateInsights(latestResults, priorityStrategies, topDueItems)
      .pipe(finalize(() => this.isLoadingInsights.set(false)))
      .subscribe(result => {
        if ('error' in result) {
            this.toastService.show(result.error, 'error');
            this.insightsResult.set('Falha ao gerar análise.');
        } else if (result.insights) {
            this.insightsResult.set(result.insights);
        }
      });
  }

  toggleStatsMinimized(): void {
    this.uiLayoutService.toggleMinimized('dashboardTabStats');
  }

  toggleSummaryMinimized(): void {
    this.uiLayoutService.toggleMinimized('dashboardTabSummary');
  }

  toggleInsightsMinimized(): void {
    this.uiLayoutService.toggleMinimized('dashboardTabInsights');
  }
}