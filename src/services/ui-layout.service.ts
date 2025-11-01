
import { Injectable, signal, computed } from '@angular/core';

type TabType = 'input' | 'strategies' | 'dashboard' | 'analysis';
interface CardDefinition {
  key: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class UiLayoutService {
  private readonly LAYOUT_KEY = 'ui-layout-state';
  private state = signal<Record<string, any>>({});

  private readonly cardRegistry: Record<TabType, CardDefinition[]> = {
    input: [
      { key: 'inputCardAddResultVisible', label: 'Adicionar Resultado' },
      { key: 'inputCardStrategyStreaksVisible', label: 'Estratégias Ativas' },
      { key: 'inputCardLiveCorrelationVisible', label: 'Correlações ao Vivo' },
      { key: 'inputCardRecentResultsVisible', label: 'Resultados Recentes' },
    ],
    strategies: [
      { key: 'strategiesCardCreatorVisible', label: 'Criador de Estratégias' },
      { key: 'strategiesCardManagementVisible', label: 'Gerenciamento do App' },
      { key: 'strategiesCardMonitorVisible', label: 'Monitor de Estratégias' },
    ],
    dashboard: [
      { key: 'dashboardCardStatsVisible', label: 'Estatísticas Gerais' },
      { key: 'dashboardCardSummaryVisible', label: 'Resumo das Estratégias' },
      { key: 'dashboardCardInsightsVisible', label: 'Insights da IA' },
      { key: 'dashboardCardDueAnalysisVisible', label: 'Análise de Atrasos' },
      { key: 'dashboardCardRecentResultsVisible', label: 'Resultados Recentes' },
    ],
    analysis: [
      { key: 'analysisCardWheelVisible', label: 'Visão da Roleta' },
      { key: 'analysisCardHotColdVisible', label: 'Números Quentes & Frios' },
      { key: 'analysisCardCorrelationVisible', label: 'Correlação de Números' },
      { key: 'analysisCardDistributionVisible', label: 'Distribuição de Números' },
      { key: 'analysisCardTrendsVisible', label: 'Tendências de Cor & Paridade' },
      { key: 'analysisCardStreaksVisible', label: 'Sequências das Estratégias' },
    ],
  };

  readonly state$ = this.state.asReadonly();

  // Computed signals for each tab's card configuration
  readonly inputTabCards = computed(() => this.getOrderedCardsForTab('input'));
  readonly strategiesTabCards = computed(() => this.getOrderedCardsForTab('strategies'));
  readonly dashboardTabCards = computed(() => this.getOrderedCardsForTab('dashboard'));
  readonly analysisTabCards = computed(() => this.getOrderedCardsForTab('analysis'));

  constructor() {
    this.loadState();
  }
  
  private loadState(): void {
    const savedState = localStorage.getItem(this.LAYOUT_KEY);
    let parsed: Record<string, any> = {};
    if (savedState) {
        try {
            parsed = JSON.parse(savedState);
        } catch(e) {
            console.error('Failed to parse UI layout state from localStorage', e);
            localStorage.removeItem(this.LAYOUT_KEY);
        }
    }
    // Merge with defaults to ensure new keys and orders are added gracefully
    this.state.set({ ...this.getDefaults(), ...parsed });

    // Ensure order arrays exist and contain all keys
    for (const tab of Object.keys(this.cardRegistry) as TabType[]) {
        const orderKey = `${tab}TabCardOrder`;
        const defaultOrder = this.cardRegistry[tab].map(c => c.key);
        let currentOrder = this.state()[orderKey] as string[] || [];

        // Add new keys from default if they don't exist
        for (const key of defaultOrder) {
            if (!currentOrder.includes(key)) {
                currentOrder.push(key);
            }
        }
        // Remove old keys that are no longer in default
        currentOrder = currentOrder.filter(key => defaultOrder.includes(key));
        
        this.state.update(s => ({...s, [orderKey]: currentOrder}));
    }
  }

  private getDefaults(): Record<string, any> {
     const defaults: Record<string, any> = {
        // Minimized States (for collapsibles)
        'inputTabAddResult': false, 'dashboardTabStats': true, 'dashboardTabSummary': true,
        'dashboardTabInsights': true, 'dueAnalysis': true, 'dashboardRecentResults': true,
        'analysisTabWheelView': true, 'hotColdNumbers': true, 'numberCorrelation': true,
        'distributionChart': true, 'trendsChart': true, 'analysisStrategyStreaks': true,
        'configTabAppearance': true, 'configTabTutorial': true, 'configTabAdvanced': true,
        'configTabDangerZone': true, 'configTabInterface': false, 'strategiesTabCreator': true,
        'strategiesTabManagement': true, 'strategiesTabMonitor': true,
    };

    for (const [tab, cards] of Object.entries(this.cardRegistry)) {
        defaults[`${tab}TabCardOrder`] = cards.map(c => c.key);
        for (const card of cards) {
            defaults[card.key] = true; // Default visibility
        }
    }
    return defaults;
  }
  
  private getOrderedCardsForTab(tab: TabType): CardDefinition[] {
    const order = this.state()[`${tab}TabCardOrder`] as string[] || [];
    const definitions = this.cardRegistry[tab];
    const orderedCards = order
        .map(key => definitions.find(d => d.key === key))
        .filter((c): c is CardDefinition => !!c);
    return orderedCards;
  }

  private saveState(): void {
    localStorage.setItem(this.LAYOUT_KEY, JSON.stringify(this.state()));
  }

  isMinimized(key: string) {
    return computed(() => this.state()[key] ?? false);
  }
  
  isVisible(key: string) {
    return computed(() => this.state()[key] ?? true); // Default to visible
  }

  toggleMinimized(key: string): void {
    this.state.update(current => ({ ...current, [key]: !current[key] }));
    this.saveState();
  }
  
  setVisibility(key: string, visible: boolean): void {
     this.state.update(current => ({ ...current, [key]: visible }));
     this.saveState();
  }

  moveCardUp(tab: TabType, cardKey: string): void {
    const orderKey = `${tab}TabCardOrder`;
    this.state.update(current => {
      const order = [...(current[orderKey] as string[])];
      const index = order.indexOf(cardKey);
      if (index > 0) {
        [order[index - 1], order[index]] = [order[index], order[index - 1]]; // Swap
      }
      return { ...current, [orderKey]: order };
    });
    this.saveState();
  }

  moveCardDown(tab: TabType, cardKey: string): void {
    const orderKey = `${tab}TabCardOrder`;
    this.state.update(current => {
      const order = [...(current[orderKey] as string[])];
      const index = order.indexOf(cardKey);
      if (index < order.length - 1 && index !== -1) {
        [order[index + 1], order[index]] = [order[index], order[index + 1]]; // Swap
      }
      return { ...current, [orderKey]: order };
    });
    this.saveState();
  }
}