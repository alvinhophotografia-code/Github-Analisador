
export interface RouletteStats {
  totalSpins: number;
  redCount: number;
  blackCount: number;
  greenCount: number;
  evenCount: number;
  oddCount: number;
  lastNumber: number | undefined;
}

export type StrategyType = 
  | 'color' | 'parity' | 'range' | 'dozen' | 'column' 
  | 'single_number' | 'number_set' | 'target_numbers' | 'neighbors' | 'cyclical';

export type ColorValue = 'red' | 'black' | 'green';
export type ParityValue = 'even' | 'odd';
export type RangeValue = 'low' | 'high';
export type DozenValue = 'first' | 'second' | 'third';
export type ColumnValue = 'first' | 'second' | 'third';

export type StrategyValue =
  | { type: 'color'; value: ColorValue }
  | { type: 'parity'; value: ParityValue }
  | { type: 'range'; value: RangeValue }
  | { type: 'dozen'; value: DozenValue }
  | { type: 'column'; value: ColumnValue }
  | { type: 'single_number'; value: number }
  | { type: 'number_set'; value: number[] }
  | { type: 'target_numbers'; value: { base: number[]; targets: number[] } }
  | { type: 'neighbors'; value: { center: number; count: number } }
  | { 
      type: 'cyclical'; 
      value: {
        target: StrategyValue; // Cannot be another cyclical strategy
        interval: number;
        ignoreSubsequent: boolean;
      }
    };

export interface Strategy {
  id: string;
  name: string;
  sequence: StrategyValue[];
  active: boolean;
  hits: number;
  losses: number;
  currentStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  history: Array<{ spin: number; result: 'hit' | 'loss' }>;
  createdAt: number; // Stored as timestamp
  isPriority: boolean;
  alertOnPriority: boolean;
  currentConsecutiveHits: number;
  pendingCheck?: { checkAtSpin: number } | null; // For cyclical delay strategies
}

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export interface ExportData {
  version: number;
  exportedAt: string;
  results: number[];
  strategies: Strategy[];
}

export type BettingSystem = 'flat' | 'martingale' | 'dalembert' | 'fibonacci' | 'labouchere';

export interface BankrollDataPoint {
  spin: number;
  bankroll: number;
}

export interface SimulationResult {
  totalSpins: number;
  hits: number;
  losses: number;
  hitRate: number; // as percentage
  finalBankroll: number;
  peakBankroll: number;
  maxDrawdown: number; // absolute value
  profit: number;
  bankrollHistory: BankrollDataPoint[];
}

export type RouletteType = 'european' | 'american';
export type HeatmapMode = 'frequency' | 'delay';

export interface SimulationConfig {
  id: string;
  name: string;
  strategyId: string;
  dataSource: 'current' | 'generated';
  generatedSpins: number;
  initialBankroll: number;
  baseBet: number;
  bettingSystem: BettingSystem;
  stopLoss: number;
  takeProfit: number;
}