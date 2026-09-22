import type { State, EventSymbol, Transition } from "./transition";

/**
 * DFA 資料結構與 Simulation（計畫書第 11 節）。
 * Waiting State（9.3 節）之後接上時間系統時，只需要在 transitions 裡加上對應的
 * StaffAbsent / ReturnLater transition，不需要改這個類別本身。
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

  /** 目前 state 底下所有合法的下一步事件，REJECT 時用來顯示「應該要做什麼」。 */
  getExpectedEvents(currentState: State): EventSymbol[] {
    return this.transitions
      .filter((transition) => transition.from === currentState)
      .map((transition) => transition.event);
  }

  isAccepting(state: State): boolean {
    return this.acceptingStates.includes(state);
  }
}
