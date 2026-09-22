import type { State, EventSymbol } from "./transition";

export interface NfaTransition {
  from: State;
  event: EventSymbol;
  /** NFA 的核心差異：同一個 (state, event) 可以對應到多個下一個 state。 */
  to: State[];
}

export interface EpsilonTransition {
  from: State;
  to: State;
}

/**
 * NFA 資料結構（計畫書第 12 節），用於具有多條合法路徑的流程。
 * 例如「系辦、系主任兩邊都要跑，但順序不限」：與其手動設計一個記錄
 * 「目前完成了哪些」的 DFA，不如直接用 ε-transition 把「先跑系辦」跟
 * 「先跑系主任」兩條路徑並列起來 —— 這正是 NFA 最自然的用法
 * （對應正規表達式的 union／交錯順序），再用 nfaToDfa()（第 13 節）
 * 轉成遊戲實際執行用的 DFA。
 */
export class NFA {
  constructor(
    readonly states: State[],
    readonly alphabet: EventSymbol[],
    readonly transitions: NfaTransition[],
    readonly epsilonTransitions: EpsilonTransition[],
    readonly initialState: State,
    readonly acceptingStates: State[]
  ) {}

  getNextStates(currentState: State, event: EventSymbol): State[] {
    const match = this.transitions.find(
      (transition) => transition.from === currentState && transition.event === event
    );
    return match ? match.to : [];
  }

  /** 从一組 state 出發，只走 ε-transition 能到達的所有 state（含自己）。 */
  epsilonClosure(states: Iterable<State>): Set<State> {
    const closure = new Set(states);
    const stack = [...closure];
    while (stack.length > 0) {
      const current = stack.pop() as State;
      for (const transition of this.epsilonTransitions) {
        if (transition.from === current && !closure.has(transition.to)) {
          closure.add(transition.to);
          stack.push(transition.to);
        }
      }
    }
    return closure;
  }
}
