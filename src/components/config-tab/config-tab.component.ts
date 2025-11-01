import { ChangeDetectionStrategy, Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiStateService } from '../../services/ui-state.service';
import { UiLayoutService } from '../../services/ui-layout.service';
import { RouletteService } from '../../services/roulette.service';
import { StrategyService } from '../../services/strategy.service';
import { ToastService } from '../../services/toast.service';
import { RouletteType } from '../../types';

type TabType = 'input' | 'strategies' | 'dashboard' | 'analysis';

@Component({
  selector: 'app-config-tab',
  templateUrl: './config-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  standalone: true,
})
export class ConfigTabComponent {
  uiStateService = inject(UiStateService);
  uiLayoutService = inject(UiLayoutService);
  private rouletteService = inject(RouletteService);
  private strategyService = inject(StrategyService);
  private toastService = inject(ToastService);
  
  isAppearanceMinimized = this.uiLayoutService.isMinimized('configTabAppearance');
  isTutorialMinimized = this.uiLayoutService.isMinimized('configTabTutorial');
  isAdvancedMinimized = this.uiLayoutService.isMinimized('configTabAdvanced');
  isDangerZoneMinimized = this.uiLayoutService.isMinimized('configTabDangerZone');
  isInterfaceMinimized = this.uiLayoutService.isMinimized('configTabInterface');

  animationsEnabled = this.uiStateService.animationsEnabled;
  priorityThreshold = this.uiStateService.priorityThreshold;
  darkModeEnabled = this.uiStateService.darkModeEnabled;
  customThemeColor = this.uiStateService.customThemeColor;
  customBackgroundColor = this.uiStateService.customBackgroundColor;
  rouletteType = this.uiStateService.rouletteType;

  // Card visibility signals from UiLayoutService
  inputCards = this.uiLayoutService.inputTabCards;
  strategiesCards = this.uiLayoutService.strategiesTabCards;
  dashboardCards = this.uiLayoutService.dashboardTabCards;
  analysisCards = this.uiLayoutService.analysisTabCards;

  isCardVisible = (key: string) => this.uiLayoutService.isVisible(key)();

  // Provide a default value for the color picker if the signal is null
  colorPickerValue = computed(() => this.customThemeColor() || '#14b8a6');
  bgColorPickerValue = computed(() => {
    const customColor = this.customBackgroundColor();
    if (customColor) return customColor;
    return this.darkModeEnabled() ? '#121721' : '#f8fafc';
  });
  
  resetConfirmation = signal('');

  setCustomTheme(event: Event): void {
    const newColor = (event.target as HTMLInputElement).value;
    this.uiStateService.setCustomThemeColor(newColor);
  }

  resetTheme(): void {
    this.uiStateService.setCustomThemeColor(null);
  }

  setCustomBackground(event: Event): void {
    const newColor = (event.target as HTMLInputElement).value;
    this.uiStateService.setCustomBackgroundColor(newColor);
  }

  resetBackground(): void {
    this.uiStateService.setCustomBackgroundColor(null);
  }
  
  showTutorial(): void {
    this.uiStateService.showTutorial();
  }

  setAnimationsEnabled(enabled: boolean): void {
    this.uiStateService.setAnimationsEnabled(enabled);
  }

  setDarkMode(enabled: boolean): void {
    this.uiStateService.setDarkMode(enabled);
  }
  
  setRouletteType(type: RouletteType): void {
    this.uiStateService.setRouletteType(type);
  }

  toggleCardVisibility(key: string, visible: boolean): void {
    this.uiLayoutService.setVisibility(key, visible);
  }

  moveUp(tab: TabType, cardKey: string): void {
    this.uiLayoutService.moveCardUp(tab, cardKey);
  }

  moveDown(tab: TabType, cardKey: string): void {
    this.uiLayoutService.moveCardDown(tab, cardKey);
  }

  setPriorityThreshold(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const threshold = parseInt(value, 10);
    if (!isNaN(threshold) && threshold >= 1) {
      this.uiStateService.setPriorityThreshold(threshold);
    }
  }

  resetApplication(): void {
    if (this.resetConfirmation() !== 'RESETAR') {
        this.toastService.show('Confirmação incorreta. Ação cancelada.', 'error');
        return;
    }

    this.rouletteService.clearResults();
    this.strategyService.clearAllStrategies();
    
    // Clear all localStorage keys related to the app
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('roulette') || key.startsWith('app-') || key.startsWith('ui-') || key === 'hasSeenOnboarding' || key === 'creatorMode') {
            localStorage.removeItem(key);
        }
    });

    this.toastService.show('Aplicação resetada com sucesso. A página será recarregada.', 'success', 3000);

    setTimeout(() => window.location.reload(), 3000);
  }

  toggleAppearanceMinimized(): void {
    this.uiLayoutService.toggleMinimized('configTabAppearance');
  }

  toggleInterfaceMinimized(): void {
    this.uiLayoutService.toggleMinimized('configTabInterface');
  }

  toggleTutorialMinimized(): void {
    this.uiLayoutService.toggleMinimized('configTabTutorial');
  }

  toggleAdvancedMinimized(): void {
    this.uiLayoutService.toggleMinimized('configTabAdvanced');
  }

  toggleDangerZoneMinimized(): void {
    this.uiLayoutService.toggleMinimized('configTabDangerZone');
  }
}