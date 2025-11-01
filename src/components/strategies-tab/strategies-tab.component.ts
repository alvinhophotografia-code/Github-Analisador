
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { StrategyCreatorComponent } from '../strategy-creator/strategy-creator.component';
import { StrategyMonitorComponent } from '../strategy-monitor/strategy-monitor.component';

import { StrategyService } from '../../services/strategy.service';
import { RouletteService } from '../../services/roulette.service';
import { ToastService } from '../../services/toast.service';
import { UiLayoutService } from '../../services/ui-layout.service';

import { ExportData } from '../../types';

@Component({
  selector: 'app-strategies-tab',
  templateUrl: './strategies-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, StrategyCreatorComponent, StrategyMonitorComponent]
})
export class StrategiesTabComponent {
  strategyService = inject(StrategyService);
  rouletteService = inject(RouletteService);
  toastService = inject(ToastService);
  uiLayoutService = inject(UiLayoutService);
  
  isCreatorMinimized = this.uiLayoutService.isMinimized('strategiesTabCreator');
  isManagementMinimized = this.uiLayoutService.isMinimized('strategiesTabManagement');
  isMonitorMinimized = this.uiLayoutService.isMinimized('strategiesTabMonitor');

  // Card order and visibility signals
  cards = this.uiLayoutService.strategiesTabCards;
  isCardVisible = (key: string) => this.uiLayoutService.isVisible(key)();

  clearAllStrategies() {
    if (this.strategyService.strategies().length > 0) {
      this.strategyService.clearAllStrategies();
    }
  }

  exportData(): void {
    const data: ExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      results: this.rouletteService.results(),
      strategies: this.strategyService.strategies(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roulette-analyzer-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.toastService.show('Dados exportados com sucesso.', 'success');
  }

  onDataImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as ExportData;
        // Basic validation
        if (data.version === 1 && Array.isArray(data.results) && Array.isArray(data.strategies)) {
            this.rouletteService.loadResults(data.results);
            this.strategyService.loadStrategies(data.strategies);
            this.toastService.show('Dados importados com sucesso.', 'success');
        } else {
          throw new Error('Arquivo de dados inválido ou corrompido.');
        }
      } catch (e) {
        this.toastService.show('Falha ao importar dados. O arquivo pode ser inválido.', 'error');
        console.error('Erro de Importação:', e);
      } finally {
          input.value = ''; // Reset file input
      }
    };
    reader.readAsText(file);
  }
  
  toggleCreatorMinimized(): void {
    this.uiLayoutService.toggleMinimized('strategiesTabCreator');
  }

  toggleManagementMinimized(): void {
    this.uiLayoutService.toggleMinimized('strategiesTabManagement');
  }

  toggleMonitorMinimized(): void {
    this.uiLayoutService.toggleMinimized('strategiesTabMonitor');
  }
}