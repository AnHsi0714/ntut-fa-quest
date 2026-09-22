import type { State, EventSymbol } from "./transition";

export interface NfaTransition {
  from: State;
  event: EventSymbol;
  to: State[];
}

/**
 * NFA 資料結構骨架（計畫書第 12 節），用於具有多條合法路徑的流程。
 * Simulation（同時追蹤多個可能狀態）留待 Phase 2 實作。
 */
export class NFA {
  constructor(
    readonly states: State[],
    readonly alphabet: EventSymbol[],
    readonly transitions: NfaTransition[],
    readonly initialState: State,
    readonly acceptingStates: State[]
  ) {}

  getNextStates(currentState: State, event: EventSymbol): State[] {
    const match = this.transitions.find(
      (transition) => transition.from === currentState && transition.event === event
    );
    return match ? match.to : [];
  }
}
