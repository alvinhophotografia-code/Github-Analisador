
import { ChangeDetectionStrategy, Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

import { InputTabComponent } from './components/input-tab/input-tab.component';
import { StrategiesTabComponent } from './components/strategies-tab/strategies-tab.component';
import { DashboardTabComponent } from './components/dashboard-tab/dashboard-tab.component';
import { AnalysisTabComponent } from './components/analysis-tab/analysis-tab.component';
import { BacktestTabComponent } from './components/backtest-tab/backtest-tab.component';
import { ConfigTabComponent } from './components/config-tab/config-tab.component';
import { ToastContainerComponent } from './components/toast-container/toast-container.component';
import { OnboardingTutorialComponent } from './components/onboarding-tutorial/onboarding-tutorial.component';

import { RouletteService } from './services/roulette.service';
import { StrategyService } from './services/strategy.service';
import { GeminiService } from './services/gemini.service';
import { ToastService } from './services/toast.service';
import { UiStateService } from './services/ui-state.service';
import { UiLayoutService } from './services/ui-layout.service';
import { hexToHsl } from './utils';

type Tab = 'input' | 'strategies' | 'dashboard' | 'analysis' | 'backtest' | 'config';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    InputTabComponent,
    StrategiesTabComponent,
    DashboardTabComponent,
    AnalysisTabComponent,
    BacktestTabComponent,
    ConfigTabComponent,
    ToastContainerComponent,
    OnboardingTutorialComponent
  ],
  providers: [RouletteService, StrategyService]
})
export class AppComponent {
  private uiStateService = inject(UiStateService);
  activeTab = signal<Tab>('input');
  
  showOnboarding = this.uiStateService.showOnboarding;
  
  tabs: {id: Tab, name: string}[] = [
      { id: 'input', name: 'Entrada' },
      { id: 'strategies', name: 'Estratégias' },
      { id: 'dashboard', name: 'Painel' },
      { id: 'analysis', name: 'Análise' },
      { id: 'backtest', name: 'Simulação' },
      { id: 'config', name: 'Config' },
  ];

  constructor() {
    effect(() => {
      const animationsEnabled = this.uiStateService.animationsEnabled();
      if (animationsEnabled) {
        document.documentElement.classList.remove('no-animations');
      } else {
        document.documentElement.classList.add('no-animations');
      }
    });

    effect(() => {
      const isDark = this.uiStateService.darkModeEnabled();
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });

    effect(() => {
      const customColorHex = this.uiStateService.customThemeColor();
      const isDark = this.uiStateService.darkModeEnabled();
      const rootStyle = document.documentElement.style;

      if (!customColorHex) {
        // Reset to default theme from styles.css
        rootStyle.removeProperty('--primary');
        rootStyle.removeProperty('--accent');
        rootStyle.removeProperty('--ring');
        return;
      }

      const hsl = hexToHsl(customColorHex);
      if (!hsl) return;
      
      let primaryHsl, accentHsl, ringHsl;

      if (isDark) {
        // Brighter, more saturated for dark mode
        const darkS = Math.min(100, hsl.s + 10);
        const darkL = Math.min(100, hsl.l > 60 ? hsl.l : hsl.l + 10);
        primaryHsl = `${hsl.h} ${darkS}% ${darkL}%`;
      } else {
        // Duller, darker for light mode to ensure contrast
        const lightS = Math.max(0, hsl.s - 5);
        const lightL = Math.max(0, hsl.l - 10);
        primaryHsl = `${hsl.h} ${lightS}% ${lightL}%`;
      }
      
      accentHsl = primaryHsl;
      ringHsl = primaryHsl;

      rootStyle.setProperty('--primary', primaryHsl);
      rootStyle.setProperty('--accent', accentHsl);
      rootStyle.setProperty('--ring', ringHsl);
    });

    effect(() => {
      const customBgHex = this.uiStateService.customBackgroundColor();
      const isDark = this.uiStateService.darkModeEnabled();
      const rootStyle = document.documentElement.style;

      if (!customBgHex) {
        // Reset to defaults from styles.css
        rootStyle.removeProperty('--background');
        rootStyle.removeProperty('--card');
        rootStyle.removeProperty('--popover');
        document.body.style.background = ''; // This will let the CSS gradient take over
        return;
      }

      const hsl = hexToHsl(customBgHex);
      if (!hsl) return;

      let bgHsl, cardHsl, popoverHsl;

      if (isDark) {
        const bgL = Math.min(15, hsl.l * 0.4);
        const bgS = Math.max(5, hsl.s * 0.6);
        const cardL = Math.min(20, hsl.l * 0.4 + 4); // Slightly lighter than bg
        const cardS = bgS;
        
        bgHsl = `${hsl.h} ${bgS}% ${bgL}%`;
        cardHsl = `${hsl.h} ${cardS}% ${cardL}%`;
        popoverHsl = cardHsl;
      } else { // Light mode
        const bgL = Math.max(97, 100 - (100 - hsl.l) * 0.1);
        const bgS = Math.min(40, hsl.s * 0.5);
        const cardL = 100; // Keep cards white in light mode for max contrast
        const cardS = 0;

        bgHsl = `${hsl.h} ${bgS}% ${bgL}%`;
        cardHsl = `${hsl.h} ${cardS}% ${cardL}%`; // This will be white
        popoverHsl = cardHsl;
      }

      rootStyle.setProperty('--background', bgHsl);
      rootStyle.setProperty('--card', cardHsl);
      rootStyle.setProperty('--popover', popoverHsl);
      document.body.style.background = `hsl(${bgHsl})`;
    });
  }

  selectTab(tab: Tab): void {
    this.activeTab.set(tab);
  }
}