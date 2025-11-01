
import { Injectable, signal, computed, WritableSignal, Signal } from '@angular/core';
import { RouletteStats } from '../types';
import { getNumberColor, getNumberParity, RED_NUMBERS, BLACK_NUMBERS, AMERICAN_00 } from '../utils';

@Injectable()
export class RouletteService {
  readonly results: WritableSignal<number[]> = signal([]);

  readonly stats: Signal<RouletteStats> = computed(() => {
    const res = this.results();
    const redCount = res.filter(n => getNumberColor(n) === 'red').length;
    const blackCount = res.filter(n => getNumberColor(n) === 'black').length;
    const greenCount = res.filter(n => n === 0 || n === AMERICAN_00).length;
    const evenCount = res.filter(n => getNumberParity(n) === 'even').length;
    const oddCount = res.filter(n => getNumberParity(n) === 'odd').length;

    return {
      totalSpins: res.length,
      redCount,
      blackCount,
      greenCount,
      evenCount,
      oddCount,
      lastNumber: res.length > 0 ? res[0] : undefined,
    };
  });
  
  constructor() {
    const savedResults = localStorage.getItem('rouletteResults');
    if (savedResults) {
      try {
        const parsedResults = JSON.parse(savedResults);
        // Validate that the parsed data is an array of valid numbers
        if (Array.isArray(parsedResults) && parsedResults.every(item => typeof item === 'number' && item >= 0 && item <= 37)) {
          this.results.set(parsedResults);
        } else {
          console.warn("Corrupted or invalid roulette results in localStorage. Resetting.");
          localStorage.removeItem('rouletteResults');
        }
      } catch (e) {
        console.error("Failed to parse roulette results from localStorage", e);
        localStorage.removeItem('rouletteResults'); // Clear corrupted data
      }
    }
  }

  addResult(num: number | string): void {
    const value = num === '00' ? AMERICAN_00 : Number(num);
    if (value >= 0 && value <= 37) {
      this.results.update(current => {
        const newResults = [value, ...current];
        localStorage.setItem('rouletteResults', JSON.stringify(newResults));
        return newResults;
      });
    }
  }

  undoLastResult(): void {
    this.results.update(current => {
        const newResults = current.slice(1);
        localStorage.setItem('rouletteResults', JSON.stringify(newResults));
        return newResults;
    });
  }

  clearResults(): void {
    this.results.set([]);
    localStorage.removeItem('rouletteResults');
  }
  
  loadResults(results: number[]): void {
    const validResults = results.filter(n => typeof n === 'number' && n >= 0 && n <= 37);
    this.results.set(validResults);
    localStorage.setItem('rouletteResults', JSON.stringify(validResults));
  }
}