import type { State, EventSymbol, Transition } from "./transition";

/**
 * DFA 資料結構骨架（計畫書第 11 節）。
 * State / Alphabet / Transition Function / Initial / Accepting 已就緒，
 * Simulation（含 Waiting State，見 9.3 節）留待 Phase 2 實作。
 */
export class DFA {
  constructor(
    readonly states: State[],
    readonly alphabet: EventSymbol[],
    readonly transitions: Transition[],
    readonly initialState: State,
    readonly acceptingStates: State[]
  ) {}

  /** 依目前 state 與 event 找出對應的 transition，找不到代表 Invalid Transition。 */
  getNextState(currentState: State, event: EventSymbol): State | null {
    const match = this.transitions.find(
      (transition) => transition.from === currentState && transition.event === event
    );
    return match ? match.to : null;
  }

  isAccepting(state: State): boolean {
    return this.acceptingStates.includes(state);
  }
}
