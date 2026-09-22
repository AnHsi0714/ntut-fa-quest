import type { EventSymbol, State } from "../automata/transition";

/** 對應計畫書第 15 節：非法 Trace 時要顯示的錯誤資訊。 */
export interface Counterexample {
  stepIndex: number;
  currentState: State;
  receivedEvent: EventSymbol;
  expectedEvents: EventSymbol[];
}
