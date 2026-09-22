import type { DFA } from "../automata/DFA";
import type { EventSymbol } from "../automata/transition";
import { Trace } from "./trace";
import type { Counterexample } from "./counterexample";

export type VerificationResult =
  | { status: "accept" }
  | { status: "reject"; counterexample: Counterexample };

/**
 * Verification Engine 骨架（計畫書第 14 節）。
 * 設計原則（第 4 節）：事後驗證，不攔截玩家移動；每個 Event 發生當下即時檢查 transition 是否存在，
 * 不存在則標記 Invalid Transition，直到送出文件才結算 ACCEPT / REJECT。
 * TODO（Phase 3）：實作 handleEvent() 與最終結算邏輯。
 */
export class Verifier {
  private readonly trace = new Trace();
  private currentState: string;

  constructor(private readonly automaton: DFA) {
    this.currentState = automaton.initialState;
  }

  /** 處理一個玩家事件；回傳這一步是否合法。TODO：串接 Trace 與 Counterexample 顯示。 */
  handleEvent(event: EventSymbol): boolean {
    const nextState = this.automaton.getNextState(this.currentState, event);
    const isValid = nextState !== null;
    this.trace.record({
      event,
      fromState: this.currentState,
      toState: nextState,
      isValid,
      timestamp: Date.now(),
    });
    if (nextState) {
      this.currentState = nextState;
    }
    return isValid;
  }

  getTrace(): Trace {
    return this.trace;
  }
}
