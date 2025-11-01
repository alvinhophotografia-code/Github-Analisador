
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouletteWheelComponent } from '../roulette-wheel/roulette-wheel.component';
import { HotColdNumbersComponent } from '../hot-cold-numbers/hot-cold-numbers.component';
import { StrategyStreaksComponent } from '../strategy-streaks/strategy-streaks.component';
import { NumberCorrelationComponent } from '../number-correlation/number-correlation.component';
import { DistributionChartComponent } from '../distribution-chart/distribution-chart.component';
import { TrendsChartComponent } from '../trends-chart/trends-chart.component';
import { UiLayoutService } from '../../services/ui-layout.service';
import { UiStateService } from '../../services/ui-state.service';
import { HeatmapMode } from '../../types';

@Component({
  selector: 'app-analysis-tab',
  templateUrl: './analysis-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouletteWheelComponent, HotColdNumbersComponent, StrategyStreaksComponent, NumberCorrelationComponent, DistributionChartComponent, TrendsChartComponent]
})
export class AnalysisTabComponent {
  uiLayoutService = inject(UiLayoutService);
  uiStateService = inject(UiStateService);
  
  isWheelViewMinimized = this.uiLayoutService.isMinimized('analysisTabWheelView');
  heatmapMode = this.uiStateService.heatmapMode;

  // Card order and visibility signals
  cards = this.uiLayoutService.analysisTabCards;
  isCardVisible = (key: string) => this.uiLayoutService.isVisible(key)();

  toggleWheelViewMinimized(): void {
    this.uiLayoutService.toggleMinimized('analysisTabWheelView');
  }

  setHeatmapMode(mode: HeatmapMode): void {
    this.uiStateService.setHeatmapMode(mode);
  }
}