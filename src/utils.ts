
import { ColorValue, ParityValue, RangeValue, DozenValue, ColumnValue, StrategyValue, RouletteType } from './types';

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
export const EUROPEAN_WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
// In American roulette, 00 is often placed between 1 and 27. We represent 00 as 37 internally.
export const AMERICAN_WHEEL_ORDER = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];

export const AMERICAN_00 = 37;

export function getNumberColor(num: number): ColorValue {
  if (num === 0 || num === AMERICAN_00) return 'green';
  if (RED_NUMBERS.includes(num)) return 'red';
  return 'black';
}

export function getNumberParity(num: number): ParityValue | null {
  if (num === 0 || num === AMERICAN_00) return null;
  return num % 2 === 0 ? 'even' : 'odd';
}

export function getNumberRange(num: number): RangeValue | null {
    if (num === 0 || num === AMERICAN_00) return null;
    return num >= 1 && num <= 18 ? 'low' : 'high';
}

export function getNumberDozen(num: number): DozenValue | null {
    if (num === 0 || num === AMERICAN_00) return null;
    if (num <= 12) return 'first';
    if (num <= 24) return 'second';
    return 'third';
}

export function getNumberColumn(num: number): ColumnValue | null {
    if (num === 0 || num === AMERICAN_00) return null;
    if (num % 3 === 1) return 'first';
    if (num % 3 === 2) return 'second';
    return 'third';
}

export function matchesStrategyValue(num: number, strategyValue: StrategyValue, rouletteType: RouletteType = 'european'): boolean {
    switch (strategyValue.type) {
        case 'color':
            return getNumberColor(num) === strategyValue.value;
        case 'parity':
            return getNumberParity(num) === strategyValue.value;
        case 'range':
            return getNumberRange(num) === strategyValue.value;
        case 'dozen':
            return getNumberDozen(num) === strategyValue.value;
        case 'column':
            return getNumberColumn(num) === strategyValue.value;
        case 'single_number':
            return num === strategyValue.value;
        case 'number_set':
            return strategyValue.value.includes(num);
        case 'neighbors': {
            const neighbors = getNeighbors(strategyValue.value.center, strategyValue.value.count, rouletteType);
            return neighbors.includes(num);
        }
        case 'target_numbers':
            // This is stateful and handled entirely in strategy.service.ts
            return false;
        default:
            return false;
    }
}

export function getNeighbors(center: number, count: number, rouletteType: RouletteType): number[] {
    const wheel = rouletteType === 'american' ? AMERICAN_WHEEL_ORDER : EUROPEAN_WHEEL_ORDER;
    const centerIndex = wheel.indexOf(center);
    if (centerIndex === -1) return [center];

    const neighbors = new Set<number>([center]);
    for (let i = 1; i <= count; i++) {
        const rightIndex = (centerIndex + i) % wheel.length;
        const leftIndex = (centerIndex - i + wheel.length) % wheel.length;
        neighbors.add(wheel[rightIndex]);
        neighbors.add(wheel[leftIndex]);
    }
    return Array.from(neighbors);
}

export function hexToHsl(hex: string): { h: number, s: number, l: number } | null {
  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) return null;

  let c = hex.substring(1).split('');
  if (c.length === 3) {
    c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  }
  const num = parseInt('0x' + c.join(''), 16);

  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;

  r /= 255; g /= 255; b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}