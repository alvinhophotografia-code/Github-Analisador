
import { ChangeDetectionStrategy, Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { StrategyService } from '../../services/strategy.service';
import { GeminiService } from '../../services/gemini.service';
import { RouletteService } from '../../services/roulette.service';
import { ToastService } from '../../services/toast.service';
import { UiStateService } from '../../services/ui-state.service';
import { Strategy, StrategyType, StrategyValue } from '../../types';
import { getNeighbors } from '../../utils';

type CreatorMode = 'simple' | 'advanced';

@Component({
  selector: 'app-strategy-creator',
  templateUrl: './strategy-creator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule]
})
export class StrategyCreatorComponent {
  strategyService = inject(StrategyService);
  private geminiService = inject(GeminiService);
  private rouletteService = inject(RouletteService);
  private toastService = inject(ToastService);
  private uiStateService = inject(UiStateService);

  activeTab = signal<StrategyType>('color');
  strategyName = signal('');
  sequence = signal<StrategyValue[]>([]);
  
  creatorMode = signal<CreatorMode>('simple');
  
  isEditing = computed(() => !!this.strategyService.editingStrategy());
  
  // AI State
  aiPrompt = signal('');
  isSuggesting = signal(false);

  // Number Set state
  selectedNumbers = signal<number[]>([]);
  setNeighborCount = signal(0);

  // Neighbors state
  neighborCenter = signal<number>(0);
  neighborCount = signal(1);

  // Target Numbers state
  targetMode = signal<'base' | 'targets'>('base');
  baseNumbers = signal<number[]>([]);
  targetNumbers = signal<number[]>([]);
  targetUseNeighbors = signal(false);
  targetNeighborCount = signal(1);

  // Cyclical state
  cyclicalTarget = signal<StrategyValue | null>(null);
  cyclicalTargetType = signal<StrategyType>('color');
  cyclicalInterval = signal(5);
  cyclicalSingleNumber = signal(0);
  cyclicalIgnoreSubsequent = signal(true);

  rouletteType = this.uiStateService.rouletteType;

  allTabs: {id: StrategyType, name: string}[] = [
    {id: 'color', name: 'Cor'},
    {id: 'parity', name: 'Paridade'},
    {id: 'range', name: 'Metade'},
    {id: 'dozen', name: 'Dúzia'},
    {id: 'column', name: 'Coluna'},
    {id: 'single_number', name: 'Número'},
    {id: 'number_set', name: 'Conjunto'},
    {id: 'neighbors', name: 'Vizinhos'},
    {id: 'target_numbers', name: 'Alvo'},
    {id: 'cyclical', name: 'Cíclica'},
  ];

  visibleTabs = computed(() => {
    if (this.creatorMode() === 'simple') {
      const simpleTypes: StrategyType[] = ['color', 'parity', 'range', 'dozen', 'column'];
      return this.allTabs.filter(tab => simpleTypes.includes(tab.id));
    }
    return this.allTabs;
  });

  allNumbers = Array.from({length: 37}, (_, i) => i);

  constructor() {
    const savedMode = localStorage.getItem('creatorMode') as CreatorMode;
    if (savedMode) {
      this.creatorMode.set(savedMode);
    }

    effect(() => {
      const strategyToEdit = this.strategyService.editingStrategy();
      if (strategyToEdit) {
        this.strategyName.set(strategyToEdit.name);
        this.sequence.set(strategyToEdit.sequence);
        this.creatorMode.set('advanced'); // Always switch to advanced for editing
        document.querySelector('app-strategy-creator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        this.strategyName.set('');
        this.sequence.set([]);
      }
    });
  }

  setCreatorMode(mode: CreatorMode) {
    this.creatorMode.set(mode);
    localStorage.setItem('creatorMode', mode);
    // If current tab is not in simple mode, switch to the first available one
    if (mode === 'simple' && !this.visibleTabs().some(t => t.id === this.activeTab())) {
        this.activeTab.set('color');
    }
  }

  runBacktest(): void {
    if (this.sequence().length === 0) {
      this.toastService.show('Adicione pelo menos um passo à sequência para testar.', 'warning');
      return;
    }
    const result = this.strategyService.backtestStrategy(this.sequence());
    alert(
      `Resultado do Backtest:\n\n` +
      `Taxa de Acerto: ${result.hitRate}\n` +
      `Acertos: ${result.hits}\n` +
      `Erros: ${result.losses}\n\n` +
      `Isso simula como a estratégia teria se saído com os resultados existentes.`
    );
  }

  setCyclicalTarget(value: any) {
    let stratValue: StrategyValue | null = null;
    const type = this.cyclicalTargetType();

    switch(type) {
      case 'color': stratValue = { type: 'color', value }; break;
      case 'parity': stratValue = { type: 'parity', value }; break;
      case 'range': stratValue = { type: 'range', value }; break;
      case 'dozen': stratValue = { type: 'dozen', value }; break;
      case 'column': stratValue = { type: 'column', value }; break;
      case 'single_number': stratValue = { type: 'single_number', value: this.cyclicalSingleNumber() }; break;
    }
    this.cyclicalTarget.set(stratValue);
  }

  addStepToSequence(value: any) {
    let stratValue: StrategyValue | null = null;
    const isCyclicalInSequence = this.sequence().some(s => s.type === 'cyclical');

    if (this.activeTab() !== 'cyclical' && isCyclicalInSequence) {
      this.toastService.show('Estratégias Cíclicas devem ser o único passo na sequência.', 'warning');
      return;
    }

    switch(this.activeTab()) {
      case 'color': stratValue = { type: 'color', value }; break;
      case 'parity': stratValue = { type: 'parity', value }; break;
      case 'range': stratValue = { type: 'range', value }; break;
      case 'dozen': stratValue = { type: 'dozen', value }; break;
      case 'column': stratValue = { type: 'column', value }; break;
      case 'single_number': stratValue = { type: 'single_number', value }; break;
      case 'number_set': {
        const numbers = this.calculateNumberSet();
        if (numbers.length > 0) {
          stratValue = { type: 'number_set', value: numbers };
        }
        break;
      }
      case 'neighbors': {
        stratValue = { type: 'neighbors', value: { center: this.neighborCenter(), count: this.neighborCount() } };
        break;
      }
      case 'target_numbers': {
        if (this.baseNumbers().length === 0 || this.targetNumbers().length === 0) {
          this.toastService.show('Números de base e alvo devem ser selecionados para esta estratégia.', 'warning');
          return;
        }
        stratValue = { type: 'target_numbers', value: { base: this.baseNumbers(), targets: this.targetNumbers() } };
        break;
      }
      case 'cyclical': {
        if (this.sequence().length > 0) {
          this.toastService.show('Estratégias Cíclicas devem ser o único passo. Limpe a sequência primeiro.', 'warning');
          return;
        }
        if (!this.cyclicalTarget()) {
          this.toastService.show('Por favor, defina um Alvo para a estratégia Cíclica.', 'warning');
          return;
        }
        stratValue = {
          type: 'cyclical',
          value: {
            target: this.cyclicalTarget()!,
            interval: this.cyclicalInterval(),
            ignoreSubsequent: this.cyclicalIgnoreSubsequent()
          }
        };
        break;
      }
    }
    
    if (stratValue) {
      this.sequence.update(current => [...current, stratValue!]);
      
      // Reset UI state for complex types ONLY after successful addition
      if (stratValue.type === 'number_set') {
        this.selectedNumbers.set([]);
        this.setNeighborCount.set(0);
      } else if (stratValue.type === 'target_numbers') {
        this.baseNumbers.set([]);
        this.targetNumbers.set([]);
        this.targetUseNeighbors.set(false);
        this.targetNeighborCount.set(1);
      } else if (stratValue.type === 'cyclical') {
        this.cyclicalTarget.set(null); // Reset target after adding
      }
    }
  }

  saveStrategy() {
    if (this.sequence().length === 0) {
      this.toastService.show('A sequência não pode estar vazia.', 'warning');
      return;
    }
    
    let name = this.strategyName().trim();
    if (!name) {
      name = this.sequence().map(s => this.getStrategyValueLabel(s)).join(' → ');
    }
    
    const editingStrat = this.strategyService.editingStrategy();
    if (editingStrat) {
      this.strategyService.updateStrategy(editingStrat.id, name, this.sequence());
    } else {
      this.strategyService.addStrategy(name, this.sequence());
      this.strategyName.set('');
      this.sequence.set([]);
    }
  }

  cancelEdit(): void {
    this.strategyService.cancelEditing();
  }

  getAiSuggestion() {
    const prompt = this.aiPrompt().trim();
    if (!prompt) {
      this.toastService.show('Por favor, insira uma descrição para a sugestão da IA.', 'info');
      return;
    }
    this.isSuggesting.set(true);
    this.geminiService.suggestStrategy(this.rouletteService.results(), prompt)
      .pipe(finalize(() => this.isSuggesting.set(false)))
      .subscribe(result => {
        if ('error' in result) {
          this.toastService.show(result.error, 'error');
        } else if (result.sequence) {
          this.sequence.set(result.sequence);
          this.toastService.show('A IA gerou uma nova sequência de estratégia!', 'success');
        }
      });
  }

  removeStep(index: number) {
    this.sequence.update(current => current.filter((_, i) => i !== index));
  }
  
  private getStrategyValueTranslation(type: 'color' | 'parity' | 'range' | 'dozen' | 'column', value: string): string {
      const translations: Record<string, Record<string, string>> = {
          color: { red: 'Vermelho', black: 'Preto', green: 'Verde' },
          parity: { even: 'Par', odd: 'Ímpar' },
          range: { low: 'Baixo (1-18)', high: 'Alto (19-36)' },
          dozen: { first: '1ª Dúzia', second: '2ª Dúzia', third: '3ª Dúzia' },
          column: { first: '1ª Coluna', second: '2ª Coluna', third: '3ª Coluna' },
      };
      return translations[type]?.[value] || value;
  }

  getStrategyValueLabel(value: StrategyValue, isTarget = false): string {
    switch (value.type) {
      case 'color': return this.getStrategyValueTranslation('color', value.value);
      case 'parity': return this.getStrategyValueTranslation('parity', value.value);
      case 'range': return this.getStrategyValueTranslation('range', value.value);
      case 'dozen': return this.getStrategyValueTranslation('dozen', value.value);
      case 'column': return this.getStrategyValueTranslation('column', value.value);
      case 'single_number': return `Número ${value.value}`;
      case 'number_set': return `Conjunto (${value.value.length})`;
      case 'neighbors': return `V(${value.value.center}±${value.value.count})`;
      case 'target_numbers': return `A(B:${value.value.base.length}→A:${value.value.targets.length})`;
      case 'cyclical': {
        const targetLabel = this.getStrategyValueLabel(value.value.target, true);
        const { interval } = value.value;
        return `Repetir ${targetLabel} a cada ${interval} rodadas`;
      }
      default: return 'Desconhecido';
    }
  }

  toggleNumberSelection(num: number) {
    this.selectedNumbers.update(current => current.includes(num) ? current.filter(n => n !== num) : [...current, num]);
  }

  calculateNumberSet(): number[] {
    if (this.selectedNumbers().length === 0) return [];
    let finalSet = new Set<number>();
    this.selectedNumbers().forEach(num => {
      getNeighbors(num, this.setNeighborCount(), this.rouletteType()).forEach(n => finalSet.add(n));
    });
    return Array.from(finalSet).sort((a, b) => a - b);
  }

  toggleTargetNumber(num: number) {
    const signalToUpdate = this.targetMode() === 'base' ? this.baseNumbers : this.targetNumbers;

    const numbersToToggle = this.targetUseNeighbors()
      ? getNeighbors(num, this.targetNeighborCount(), this.rouletteType())
      : [num];

    signalToUpdate.update(current => {
      const currentSet = new Set(current);
      const isAdding = !currentSet.has(num);
      
      if (isAdding) {
        numbersToToggle.forEach(n => currentSet.add(n));
      } else {
        numbersToToggle.forEach(n => currentSet.delete(n));
      }
      return Array.from(currentSet).sort((a: number, b: number) => a - b);
    });
  }
}