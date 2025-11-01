
import { Injectable, signal, WritableSignal, effect, inject } from '@angular/core';
import { Strategy, StrategyValue, BettingSystem, SimulationResult, BankrollDataPoint } from '../types';
import { matchesStrategyValue } from '../utils';
import { RouletteService } from './roulette.service';
import { ToastService } from './toast.service';
import { UiStateService } from './ui-state.service';

@Injectable()
export class StrategyService {
  readonly strategies: WritableSignal<Strategy[]> = signal([]);
  readonly editingStrategy = signal<Strategy | null>(null);
  
  private rouletteService = inject(RouletteService);
  private toastService = inject(ToastService);
  private uiStateService = inject(UiStateService);
  private previousTotalSpins = 0;

  constructor() {
    try {
      const savedStrategies = localStorage.getItem('rouletteStrategies');
      if (savedStrategies) {
        this.strategies.set(JSON.parse(savedStrategies));
      }
    } catch (e) {
      console.error("Failed to load or parse strategies from localStorage", e);
      localStorage.removeItem('rouletteStrategies'); // Clear corrupted data
    }


    this.previousTotalSpins = this.rouletteService.results().length;

    effect(() => {
      const stats = this.rouletteService.stats();
      const totalSpins = stats.totalSpins;
      const results = this.rouletteService.results();

      // Handle additions
      if (totalSpins > this.previousTotalSpins) {
        const newResultsCount = totalSpins - this.previousTotalSpins;
        const newResults = results.slice(0, newResultsCount).reverse();

        this.strategies.update(currentStrategies => {
          let strategies = [...currentStrategies];
          for (let i = 0; i < newResults.length; i++) {
            const num = newResults[i];
            const spin = this.previousTotalSpins + 1 + i;
            
            strategies = strategies.map(s => {
              const { strategy: updatedStrategy, wasPriority } = this.updateStrategyWithResult(s, num, spin, results);
              if (updatedStrategy.isPriority && !wasPriority && updatedStrategy.alertOnPriority) {
                this.toastService.show(`'${updatedStrategy.name}' agora é uma estratégia prioritária.`, 'warning');
              }
              return updatedStrategy;
            });
          }
          const sorted = this.sortStrategies(strategies);
          localStorage.setItem('rouletteStrategies', JSON.stringify(sorted));
          return sorted;
        });
      } 
      // Handle removals (undo) - Optimized
      else if (totalSpins < this.previousTotalSpins) {
        // A full recalculation is necessary when results are removed to ensure the state
        // of all strategies (especially complex ones like 'target_numbers') is accurate.
        // Performance is maintained by optimizing other parts of the system (like charts).
        this.recalculateAllStrategies();
      } 
      // Handle CLEAR ALL
      else if (totalSpins === 0 && this.previousTotalSpins > 0) {
         this.strategies.update(currentStrategies => {
                const resetStrategies = currentStrategies.map(s => this.resetStrategyMetrics(s));
                localStorage.setItem('rouletteStrategies', JSON.stringify(resetStrategies));
                return resetStrategies;
            });
      } else if (this.previousTotalSpins === 0 && totalSpins > 0) {
        // Initial load with data
        this.recalculateAllStrategies();
      }

      this.previousTotalSpins = totalSpins;
    });
  }

  private sortStrategies(strategies: Strategy[]): Strategy[] {
    return strategies.sort((a, b) => {
        if (a.isPriority && !b.isPriority) return -1;
        if (!a.isPriority && b.isPriority) return 1;
        return b.createdAt - a.createdAt;
    });
  }

  private resetStrategyMetrics(strategy: Strategy): Strategy {
    return {
        ...strategy,
        hits: 0, losses: 0, history: [], currentStreak: 0,
        longestWinStreak: 0, longestLossStreak: 0,
        currentConsecutiveHits: 0, isPriority: false,
        pendingCheck: null,
    };
  }

  private recalculateSingleStrategy(strategy: Strategy, results: number[]): Strategy {
    let freshStrategy = this.resetStrategyMetrics(strategy);
    const reversedResults = [...results].reverse(); // oldest to newest

    for (let i = 0; i < reversedResults.length; i++) {
        const num = reversedResults[i];
        const spin = i + 1;
        const { strategy: nextState } = this.updateStrategyWithResult(freshStrategy, num, spin, results);
        freshStrategy = nextState;
    }
    return freshStrategy;
  }

  private updateStrategyWithResult(strategy: Strategy, num: number, spin: number, allResults: number[]): { strategy: Strategy, wasPriority: boolean } {
    if (!strategy.active || strategy.sequence.length === 0) return { strategy, wasPriority: strategy.isPriority };

    let s = { ...strategy };
    const wasPriority = s.isPriority;
    const currentIndex = s.currentConsecutiveHits % s.sequence.length;
    const currentStep = s.sequence[currentIndex];
    const threshold = this.uiStateService.priorityThreshold();
    const rouletteType = this.uiStateService.rouletteType();

    // --- Special logic for Cyclical strategies ---
    if (currentStep.type === 'cyclical') {
      // Default to true for older strategies from localStorage
      const { target, interval, ignoreSubsequent = true } = currentStep.value;
      const isTargetMatch = matchesStrategyValue(num, target, rouletteType);

      // Priority 1: Check if the current spin resolves a pending check.
      if (s.pendingCheck && s.pendingCheck.checkAtSpin === spin) {
        const result: 'hit' | 'loss' = isTargetMatch ? 'hit' : 'loss';
        s.history = [{ spin, result }, ...s.history].slice(0, 50);

        if (isTargetMatch) { // HIT
          s.hits++;
          s.currentStreak = s.currentStreak > 0 ? s.currentStreak + 1 : 1;
          s.longestWinStreak = Math.max(s.longestWinStreak, s.currentStreak);
          s.isPriority = false;
          // The HIT itself becomes the new trigger.
          s.pendingCheck = { checkAtSpin: spin + interval };
        } else { // LOSS
          s.losses++;
          s.currentStreak = s.currentStreak < 0 ? s.currentStreak - 1 : -1;
          s.longestLossStreak = Math.max(s.longestLossStreak, Math.abs(s.currentStreak));
          if (Math.abs(s.currentStreak) >= threshold) s.isPriority = true;
          // On loss, clear the check and wait for a new trigger.
          s.pendingCheck = null;
        }
        return { strategy: s, wasPriority }; // Resolution is a final action for this spin.
      }

      // Priority 2: If no check was resolved, check if the current number is a trigger.
      if (isTargetMatch) {
        // If we should ignore subsequent triggers and a check is already pending, do nothing.
        if (ignoreSubsequent && s.pendingCheck) {
          // Explicitly do nothing.
        } else {
          // Otherwise, set/overwrite the pending check.
          s.pendingCheck = { checkAtSpin: spin + interval };
        }
      }
      return { strategy: s, wasPriority };
    }

    // --- Special logic for Target Numbers ---
    if (currentStep.type === 'target_numbers') {
      const { base, targets } = currentStep.value;
      const isBaseHit = base.includes(num);
      const isTargetHit = targets.includes(num);

      if (s.currentConsecutiveHits === 0) { // Waiting for a base hit
        if (isBaseHit) {
          s.currentConsecutiveHits = 1;
        }
        return { strategy: s, wasPriority };
      }

      // Already had a base hit, now looking for a target
      if (s.currentConsecutiveHits >= 1) {
        const result: 'hit' | 'loss' = isTargetHit ? 'hit' : 'loss';
        s.history = [{ spin, result }, ...s.history].slice(0, 50);

        if (isTargetHit) {
          s.hits++;
          s.currentStreak = s.currentStreak > 0 ? s.currentStreak + 1 : 1;
          s.longestWinStreak = Math.max(s.longestWinStreak, s.currentStreak);
          s.isPriority = false;
        } else {
          s.losses++;
          s.currentStreak = s.currentStreak < 0 ? s.currentStreak - 1 : -1;
          s.longestLossStreak = Math.max(s.longestLossStreak, Math.abs(s.currentStreak));
          if (Math.abs(s.currentStreak) >= threshold) s.isPriority = true;
        }
        s.currentConsecutiveHits = isBaseHit ? 1 : 0; // Reset state for next round
        return { strategy: s, wasPriority };
      }
    }
    
    // --- Standard logic for all other strategies ---
    const isHit = matchesStrategyValue(num, currentStep, rouletteType);
    const result: 'hit' | 'loss' = isHit ? 'hit' : 'loss';
    s.history = [{ spin, result }, ...s.history].slice(0, 50);

    if (isHit) {
      s.currentConsecutiveHits++;
      if (s.isPriority) s.isPriority = false;

      if (s.currentConsecutiveHits % s.sequence.length === 0) {
        s.hits++;
        s.currentStreak = s.currentStreak > 0 ? s.currentStreak + 1 : 1;
        s.longestWinStreak = Math.max(s.longestWinStreak, s.currentStreak);
      }
    } else { // It's a miss
      s.losses++;
      s.currentConsecutiveHits = 0;
      s.currentStreak = s.currentStreak < 0 ? s.currentStreak - 1 : -1;
      s.longestLossStreak = Math.max(s.longestLossStreak, Math.abs(s.currentStreak));
      if (Math.abs(s.currentStreak) >= threshold) {
        s.isPriority = true;
      }
    }
    
    return { strategy: s, wasPriority };
  }
  
  private recalculateAllStrategies(): void {
    const results = this.rouletteService.results();
    if (!results) return;

    this.strategies.update(currentStrategies => {
        const updatedStrategies = currentStrategies.map(strategy => this.recalculateSingleStrategy(strategy, results));
        localStorage.setItem('rouletteStrategies', JSON.stringify(updatedStrategies));
        return updatedStrategies;
    });
  }

  addStrategy(name: string, sequence: StrategyValue[]): void {
    if (sequence.length === 0) return;
    const newStrategy: Strategy = {
      id: crypto.randomUUID(),
      name,
      sequence,
      hits: 0,
      losses: 0,
      active: true,
      history: [],
      currentStreak: 0,
      longestWinStreak: 0,
      longestLossStreak: 0,
      createdAt: Date.now(),
      isPriority: false,
      alertOnPriority: true,
      currentConsecutiveHits: 0,
      pendingCheck: null,
    };
    this.strategies.update(current => {
        const sorted = this.sortStrategies([newStrategy, ...current]);
        localStorage.setItem('rouletteStrategies', JSON.stringify(sorted));
        return sorted;
    });
    this.toastService.show(`Estratégia '${name}' criada.`, 'success');
  }

  updateStrategy(id: string, newName: string, newSequence: StrategyValue[]): void {
    this.strategies.update(current => {
      const index = current.findIndex(s => s.id === id);
      if (index === -1) return current;

      const updatedStrategy = { ...current[index], name: newName, sequence: newSequence };
      const recalculatedStrategy = this.recalculateSingleStrategy(updatedStrategy, this.rouletteService.results());
      
      const newStrategies = [...current];
      newStrategies[index] = recalculatedStrategy;

      const sorted = this.sortStrategies(newStrategies);
      localStorage.setItem('rouletteStrategies', JSON.stringify(sorted));
      return sorted;
    });
    this.cancelEditing();
    this.toastService.show(`Estratégia '${newName}' atualizada.`, 'success');
  }

  startEditing(strategy: Strategy): void {
    this.editingStrategy.set(strategy);
  }

  cancelEditing(): void {
    this.editingStrategy.set(null);
  }

  removeStrategy(id: string): void {
    let removedName: string | null = null;
    this.strategies.update(current => {
      const strategyToRemove = current.find(s => s.id === id);
      if (strategyToRemove) {
        removedName = strategyToRemove.name;
        const newStrategies = current.filter(s => s.id !== id);
        localStorage.setItem('rouletteStrategies', JSON.stringify(newStrategies));
        return newStrategies;
      }
      return current; // No change if not found
    });

    if (removedName) {
      this.toastService.show(`Estratégia '${removedName}' removida com sucesso.`, 'success');
    }
  }

  toggleStrategy(id: string): void {
    this.strategies.update(current => {
      const newStrategies = current.map(s => s.id === id ? { ...s, active: !s.active } : s);
      localStorage.setItem('rouletteStrategies', JSON.stringify(newStrategies));
      return newStrategies;
    });
  }
  
  toggleAlert(id: string): void {
    this.strategies.update(current => {
      const newStrategies = current.map(s => s.id === id ? { ...s, alertOnPriority: !s.alertOnPriority } : s);
      localStorage.setItem('rouletteStrategies', JSON.stringify(newStrategies));
      return newStrategies;
    });
  }

  resetStrategyStats(id: string): void {
     let strategyName = '';
     this.strategies.update(current => {
      const newStrategies = current.map(s => {
        if (s.id === id) {
          strategyName = s.name;
          return this.resetStrategyMetrics(s);
        }
        return s;
      });
      localStorage.setItem('rouletteStrategies', JSON.stringify(newStrategies));
      return newStrategies;
    });
    if (strategyName) {
      this.toastService.show(`Estatísticas da '${strategyName}' foram redefinidas.`, 'info');
    }
  }

  loadStrategies(strategies: Strategy[]): void {
    this.strategies.set(strategies);
    localStorage.setItem('rouletteStrategies', JSON.stringify(strategies));
    this.recalculateAllStrategies();
    this.previousTotalSpins = this.rouletteService.results().length;
  }

  clearAllStrategies(): void {
    this.strategies.set([]);
    localStorage.removeItem('rouletteStrategies');
    this.toastService.show('Todas as estratégias foram limpas.', 'success');
  }

  backtestStrategy(sequence: StrategyValue[]): { hits: number, losses: number, hitRate: string } {
    const results = this.rouletteService.results();
    if (results.length === 0 || sequence.length === 0) {
      return { hits: 0, losses: 0, hitRate: 'N/A' };
    }

    // Create a temporary strategy object for the simulation
    const tempStrategy: Strategy = {
      id: 'backtest', name: 'backtest', sequence, active: true, hits: 0, losses: 0,
      currentStreak: 0, longestWinStreak: 0, longestLossStreak: 0, history: [],
      createdAt: 0, isPriority: false, alertOnPriority: false, currentConsecutiveHits: 0,
      pendingCheck: null,
    };

    const finalState = this.recalculateSingleStrategy(tempStrategy, results);
    const total = finalState.hits + finalState.losses;
    const hitRate = total > 0 ? ((finalState.hits / total) * 100).toFixed(1) + '%' : 'N/A';

    return {
      hits: finalState.hits,
      losses: finalState.losses,
      hitRate
    };
  }

  runSimulation(
    sequence: StrategyValue[],
    results: number[],
    initialBankroll: number,
    baseBet: number,
    bettingSystem: BettingSystem,
    stopLoss: number,
    takeProfit: number
  ): SimulationResult {
    let bankroll = initialBankroll;
    let currentBet = baseBet;
    let hits = 0;
    let losses = 0;
    let currentConsecutiveHits = 0;
    let peakBankroll = initialBankroll;
    let maxDrawdown = 0;
    const bankrollHistory: BankrollDataPoint[] = [{ spin: 0, bankroll: initialBankroll }];
    const rouletteType = this.uiStateService.rouletteType();
    
    // System-specific state
    let fibSequence = [1, 1];
    let laboSequence = [1, 2, 3];

    const reversedResults = [...results].reverse(); // oldest to newest

    for (let i = 0; i < reversedResults.length; i++) {
        const num = reversedResults[i];
        const spin = i + 1;
        
        // Labouchere determines bet size dynamically
        if (bettingSystem === 'labouchere') {
            if (laboSequence.length >= 2) {
                currentBet = (laboSequence[0] + laboSequence[laboSequence.length - 1]) * baseBet;
            } else if (laboSequence.length === 1) {
                currentBet = laboSequence[0] * baseBet;
            } else { // Sequence is empty, cycle is won
                laboSequence = [1, 2, 3]; // Reset for next cycle
                currentBet = (laboSequence[0] + laboSequence[laboSequence.length - 1]) * baseBet;
            }
        }

        const currentIndex = currentConsecutiveHits % sequence.length;
        const currentStep = sequence[currentIndex];
        const isHit = matchesStrategyValue(num, currentStep, rouletteType);

        if (isHit) {
            currentConsecutiveHits++;
            if (currentConsecutiveHits % sequence.length === 0) {
                // Full sequence hit
                hits++;
                bankroll += currentBet;

                // Update bet for next round based on system
                if (bettingSystem === 'dalembert') {
                    currentBet = Math.max(baseBet, currentBet - baseBet);
                } else if (bettingSystem === 'fibonacci') {
                    fibSequence.splice(-2, 2);
                    if (fibSequence.length < 2) fibSequence = [1, 1];
                    currentBet = fibSequence[fibSequence.length-1] * baseBet;
                } else if (bettingSystem === 'labouchere') {
                    laboSequence.shift();
                    laboSequence.pop();
                } else { // Flat and Martingale reset on win
                    currentBet = baseBet;
                }
            }
        } else {
            // A miss
            losses++;
            bankroll -= currentBet;
            currentConsecutiveHits = 0;
            
            // Update bet for next round based on system
            if (bettingSystem === 'martingale') {
                currentBet *= 2;
            } else if (bettingSystem === 'dalembert') {
                currentBet += baseBet;
            } else if (bettingSystem === 'fibonacci') {
                 if (fibSequence.length < 2) fibSequence = [1,1];
                 const nextValue = fibSequence[fibSequence.length - 1] + fibSequence[fibSequence.length - 2];
                 fibSequence.push(nextValue);
                 currentBet = nextValue * baseBet;
            } else if (bettingSystem === 'labouchere') {
                laboSequence.push(currentBet / baseBet);
            }
        }
        
        peakBankroll = Math.max(peakBankroll, bankroll);
        maxDrawdown = Math.max(maxDrawdown, peakBankroll - bankroll);

        bankrollHistory.push({ spin, bankroll });

        // Check for stop conditions
        if (bankroll <= 0) {
            bankrollHistory.push(...Array(reversedResults.length - spin).fill({ spin: 0, bankroll: 0 }).map((_, j) => ({ spin: spin + j + 1, bankroll: 0 })));
            break;
        }
        if (stopLoss > 0 && bankroll <= stopLoss) {
            this.toastService.show(`Stop-Loss atingido em ${this.formatAsCurrency(stopLoss)}.`, 'info');
            break;
        }
        if (takeProfit > 0 && bankroll >= takeProfit) {
            this.toastService.show(`Take-Profit atingido em ${this.formatAsCurrency(takeProfit)}.`, 'success');
            break;
        }
    }

    const totalEvents = hits + losses;
    return {
        totalSpins: bankrollHistory.length -1,
        hits,
        losses,
        hitRate: totalEvents > 0 ? (hits / totalEvents) * 100 : 0,
        finalBankroll: bankroll,
        peakBankroll,
        maxDrawdown,
        profit: bankroll - initialBankroll,
        bankrollHistory
    };
  }

  private formatAsCurrency(value: number): string {
    return '§' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}