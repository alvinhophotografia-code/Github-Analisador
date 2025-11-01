
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RouletteService } from '../../services/roulette.service';
import { UiStateService } from '../../services/ui-state.service';
import { getNumberColor, getNumberParity, getNumberRange, getNumberDozen, getNumberColumn, AMERICAN_00 } from '../../utils';

@Component({
  selector: 'app-roulette-wheel',
  templateUrl: './roulette-wheel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class RouletteWheelComponent {
  private rouletteService = inject(RouletteService);
  private uiStateService = inject(UiStateService);

  rouletteType = this.uiStateService.rouletteType;
  heatmapMode = this.uiStateService.heatmapMode;
  lastNumber = computed(() => this.rouletteService.stats().lastNumber);
  
  allNumbers = computed(() => {
    const numbers = Array.from({ length: 37 }, (_, i) => i);
    if (this.rouletteType() === 'american') {
      numbers.push(AMERICAN_00);
    }
    return numbers;
  });

  lastNumberProperties = computed(() => {
    const num = this.lastNumber();
    if (typeof num !== 'number') return null;
    if (num === 0 || num === AMERICAN_00) {
      return { color: 'green', parity: null, range: null, dozen: null, column: null };
    }
    return {
      color: getNumberColor(num),
      parity: getNumberParity(num),
      range: getNumberRange(num),
      dozen: getNumberDozen(num),
      column: getNumberColumn(num),
    };
  });

  private frequencies = computed(() => {
    const results = this.rouletteService.results();
    const counts = new Map<number, number>();
    this.allNumbers().forEach(n => counts.set(n, 0));
    
    results.forEach(num => {
      if (Number.isInteger(num) && num >= 0 && num <= 37) {
        counts.set(num, (counts.get(num) || 0) + 1);
      }
    });
    return counts;
  });

  private delays = computed(() => {
    const results = this.rouletteService.results();
    const delayMap = new Map<number, number>();
    this.allNumbers().forEach(n => delayMap.set(n, results.length)); // Max delay if not found

    const seenNumbers = new Set<number>();
    for(let i = 0; i < results.length; i++) {
        const num = results[i];
        if (!seenNumbers.has(num)) {
            delayMap.set(num, i);
            seenNumbers.add(num);
        }
    }
    return delayMap;
  });

  private maxFrequency = computed(() => Math.max(1, ...Array.from(this.frequencies().values() as Iterable<number>)));
  private maxDelay = computed(() => Math.max(1, ...Array.from(this.delays().values() as Iterable<number>)));
  
  getHeatmapStyle(num: number): { [key: string]: string } {
      const mode = this.heatmapMode();

      if (mode === 'delay') {
        const delay = this.delays().get(num) ?? 0;
        const max = this.maxDelay();
        // Numbers that are very delayed (high delay value) should be "hot" (red/orange)
        // Numbers that appeared recently (low delay value) should be "cold" (blue)
        const intensity = Math.min(1, delay / (max * 0.75)); // Scale intensity
        
        // HSL color scale: Blue (240) -> Red (0)
        const hue = 240 - (240 * intensity);
        const lightness = 30 + 30 * intensity;
        const saturation = 50 + 50 * intensity;
        const alpha = 0.2 + 0.8 * intensity;

        // Base color for numbers that never appeared
        if (delay === this.rouletteService.results().length) {
          return { 'background-color': 'hsla(var(--muted), 0.5)' };
        }

        return { 'background-color': `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})` };
      } 
      // Default to 'frequency' mode
      else {
        const freq = this.frequencies().get(num) ?? 0;
        const maxFreq = this.maxFrequency();
        const color = getNumberColor(num);
        const colorVarName = {
            red: 'var(--roulette-red)',
            black: 'var(--roulette-black)',
            green: 'var(--roulette-green)'
        }[color];

        if (maxFreq === 0 || this.rouletteService.results().length < 10) {
          return { 'background-color': `hsl(${colorVarName})` };
        }
        
        const intensity = freq / maxFreq; 
        const alpha = 0.15 + intensity * 0.85;
        
        return { 'background-color': `hsl(${colorVarName} / ${alpha})` };
      }
  }

  readonly gridNumbers = Array.from({ length: 36 }, (_, i) => i + 1);
}