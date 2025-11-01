
import { Injectable, signal, effect, Signal } from '@angular/core';
import { RouletteType, HeatmapMode, SimulationConfig } from '../types';

@Injectable({ providedIn: 'root' })
export class UiStateService {
  readonly showOnboarding = signal<boolean>(false);
  private readonly ONBOARDING_KEY = 'hasSeenOnboarding';
  private readonly SETTINGS_KEY = 'app-settings';
  private readonly SIM_CONFIGS_KEY = 'app-sim-configs';

  // Public readonly signals
  readonly animationsEnabled: Signal<boolean>;
  readonly priorityThreshold: Signal<number>;
  readonly darkModeEnabled: Signal<boolean>;
  readonly customThemeColor: Signal<string | null>;
  readonly customBackgroundColor: Signal<string | null>;
  readonly rouletteType: Signal<RouletteType>;
  readonly heatmapMode: Signal<HeatmapMode>;
  readonly savedSimulations: Signal<SimulationConfig[]>;

  // Internal writable signals
  private _animationsEnabled = signal<boolean>(true);
  private _priorityThreshold = signal<number>(3);
  private _darkModeEnabled = signal<boolean>(true);
  private _customThemeColor = signal<string | null>(null);
  private _customBackgroundColor = signal<string | null>(null);
  private _rouletteType = signal<RouletteType>('european');
  private _heatmapMode = signal<HeatmapMode>('frequency');
  private _savedSimulations = signal<SimulationConfig[]>([]);

  constructor() {
    this.animationsEnabled = this._animationsEnabled.asReadonly();
    this.priorityThreshold = this._priorityThreshold.asReadonly();
    this.darkModeEnabled = this._darkModeEnabled.asReadonly();
    this.customThemeColor = this._customThemeColor.asReadonly();
    this.customBackgroundColor = this._customBackgroundColor.asReadonly();
    this.rouletteType = this._rouletteType.asReadonly();
    this.heatmapMode = this._heatmapMode.asReadonly();
    this.savedSimulations = this._savedSimulations.asReadonly();

    this.loadSettings();
    this.loadSimConfigs();

    // Effect to save settings whenever they change
    effect(() => {
      this.saveSettings();
    });

    const hasSeen = localStorage.getItem(this.ONBOARDING_KEY);
    if (!hasSeen) {
      this.showOnboarding.set(true);
    }
  }
  
  private loadSettings(): void {
    const savedSettings = localStorage.getItem(this.SETTINGS_KEY);
    let settings: any = {};
    if (savedSettings) {
        try {
            settings = JSON.parse(savedSettings);
        } catch(e) {
            console.error('Failed to parse app settings, using defaults.', e);
        }
    }
    // Set internal signals from loaded settings or defaults
    this._animationsEnabled.set(settings.animationsEnabled ?? true);
    this._priorityThreshold.set(settings.priorityThreshold ?? 3);
    this._darkModeEnabled.set(settings.darkModeEnabled ?? true);
    this._customThemeColor.set(settings.customThemeColor ?? null);
    this._customBackgroundColor.set(settings.customBackgroundColor ?? null);
    this._rouletteType.set(settings.rouletteType ?? 'european');
    this._heatmapMode.set(settings.heatmapMode ?? 'frequency');
  }

  private saveSettings(): void {
    const settings = {
        animationsEnabled: this.animationsEnabled(),
        priorityThreshold: this.priorityThreshold(),
        darkModeEnabled: this.darkModeEnabled(),
        customThemeColor: this.customThemeColor(),
        customBackgroundColor: this.customBackgroundColor(),
        rouletteType: this.rouletteType(),
        heatmapMode: this.heatmapMode(),
    };
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
  }

  private loadSimConfigs(): void {
    const savedConfigs = localStorage.getItem(this.SIM_CONFIGS_KEY);
    if (savedConfigs) {
      try {
        this._savedSimulations.set(JSON.parse(savedConfigs));
      } catch (e) {
        console.error('Failed to parse simulation configs', e);
      }
    }
  }

  saveSimulation(config: Omit<SimulationConfig, 'id'>): void {
    const newConfig = { ...config, id: crypto.randomUUID() };
    this._savedSimulations.update(configs => {
      const newConfigs = [...configs, newConfig];
      localStorage.setItem(this.SIM_CONFIGS_KEY, JSON.stringify(newConfigs));
      return newConfigs;
    });
  }

  deleteSimulation(id: string): void {
    this._savedSimulations.update(configs => {
      const newConfigs = configs.filter(c => c.id !== id);
      localStorage.setItem(this.SIM_CONFIGS_KEY, JSON.stringify(newConfigs));
      return newConfigs;
    });
  }

  setAnimationsEnabled(enabled: boolean): void {
    this._animationsEnabled.set(enabled);
  }

  setPriorityThreshold(threshold: number): void {
    if (threshold > 0) {
        this._priorityThreshold.set(threshold);
    }
  }

  setDarkMode(enabled: boolean): void {
    this._darkModeEnabled.set(enabled);
  }

  setCustomThemeColor(color: string | null): void {
    this._customThemeColor.set(color);
  }

  setCustomBackgroundColor(color: string | null): void {
    this._customBackgroundColor.set(color);
  }

  setRouletteType(type: RouletteType): void {
    this._rouletteType.set(type);
  }

  setHeatmapMode(mode: HeatmapMode): void {
    this._heatmapMode.set(mode);
  }

  finishOnboarding(): void {
    this.showOnboarding.set(false);
    localStorage.setItem(this.ONBOARDING_KEY, 'true');
  }

  showTutorial(): void {
    this.showOnboarding.set(true);
  }
}