import type { EventSymbol, State } from "../automata/transition";

export interface TraceStep {
  event: EventSymbol;
  fromState: State;
  toState: State | null;
  isValid: boolean;
  timestamp: number;
}

/** Trace Recorder 骨架（計畫書第 14 / 15 節）：記錄玩家實際觸發的 Event 序列。 */
export class Trace {
  private readonly steps: TraceStep[] = [];

  record(step: TraceStep): void {
    this.steps.push(step);
  }

  getSteps(): readonly TraceStep[] {
    return this.steps;
  }

  reset(): void {
    this.steps.length = 0;
  }
}
