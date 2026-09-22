/** 對應計畫書第 10 節 Formal Language 的基礎型別。 */
export type State = string;
export type EventSymbol = string;

export interface Transition {
  from: State;
  event: EventSymbol;
  to: State;
}
