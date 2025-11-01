
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StrategyService } from '../../services/strategy.service';
import { Strategy, StrategyValue } from '../../types';

@Component({
  selector: 'app-strategy-monitor',
  templateUrl: './strategy-monitor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class StrategyMonitorComponent {
  strategyService = inject(StrategyService);
  strategies = this.strategyService.strategies;
  openStates = signal<{[key: string]: boolean}>({});
  
  hitRate(strategy: Strategy): string {
    const losses = (strategy as any).losses ?? (strategy as any).misses ?? 0;
    const total = strategy.hits + losses;
    return total > 0 ? ((strategy.hits / total) * 100).toFixed(1) + '%' : 'N/A';
  }
  
  getStrategyValueLabel(value: StrategyValue, isTarget = false): string {
    switch (value.type) {
      case 'color': return value.value.charAt(0).toUpperCase();
      case 'parity': return value.value.charAt(0).toUpperCase();
      case 'range': return value.value === 'low' ? 'B' : 'A'; // Baixo / Alto
      case 'dozen': return value.value.slice(0,2);
      case 'column': return value.value.slice(0,2);
      case 'single_number': return `${value.value}`;
      case 'number_set': return `Cj(${value.value.length})`; // Conjunto
      case 'neighbors': return `V(${value.value.center}±${value.value.count})`; // Vizinhos
      case 'target_numbers': return `A(B:${value.value.base.length}→A:${value.value.targets.length})`; // Alvo
      case 'cyclical': {
        const targetLabel = this.getStrategyValueLabel(value.value.target, true);
        const { interval, ignoreSubsequent } = value.value;
        // Default ignoreSubsequent to true for older strategies. Show icon only for overwrite behavior.
        const indicator = (ignoreSubsequent === false) ? ' 🔄' : '';
        return `C(${targetLabel} › ${interval}r${indicator})`;
      }
      default: return '?';
    }
  }

  editStrategy(strategy: Strategy): void {
    this.strategyService.startEditing(strategy);
  }

  toggleStrategy(id: string): void {
    this.strategyService.toggleStrategy(id);
  }

  removeStrategy(id: string): void {
    this.strategyService.removeStrategy(id);
  }
  
  resetStrategy(id: string): void {
    this.strategyService.resetStrategyStats(id);
  }

  toggleAlert(id: string): void {
    this.strategyService.toggleAlert(id);
  }

  toggleOpen(id: string): void {
    this.openStates.update(current => ({ ...current, [id]: !current[id] }));
  }
}