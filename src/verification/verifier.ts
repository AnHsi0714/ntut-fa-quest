import type { DFA } from "../automata/DFA";
import type { EventSymbol, State } from "../automata/transition";
import { Trace } from "./trace";
import type { Counterexample } from "./counterexample";

export interface EventOutcome {
  isValid: boolean;
  fromState: State;
  toState: State;
  counterexample?: Counterexample;
}

/**
 * Verification Engine（計畫書第 14 節）。
 * 設計原則（第 4 節）：事後驗證，不攔截玩家移動；每個 Event 發生當下即時檢查 transition 是否存在。
 * 合法就推進 currentState；不合法則維持原狀、標記 Invalid Transition 並附上 Counterexample，
 * 玩家仍然可以之後補做正確的步驟（不會卡死）。
 */
export class Verifier {
  private readonly trace = new Trace();
  private currentState: State;

  constructor(private readonly automaton: DFA) {
    this.currentState = automaton.initialState;
  }

  getCurrentState(): State {
    return this.currentState;
  }

  /** 目前這個 quest 實際跑在哪個 DFA 上，給 Automaton Viewer（計畫書第 16 節）畫圖用。 */
  getAutomaton(): DFA {
    return this.automaton;
  }

  isAccepted(): boolean {
    return this.automaton.isAccepting(this.currentState);
  }

  getExpectedEvents(): EventSymbol[] {
    return this.automaton.getExpectedEvents(this.currentState);
  }

  getTrace(): Trace {
    return this.trace;
  }

  handleEvent(event: EventSymbol): EventOutcome {
    const fromState = this.currentState;
    const nextState = this.automaton.getNextState(fromState, event);
    const isValid = nextState !== null;

    this.trace.record({
      event,
      fromState,
      toState: nextState,
      isValid,
      timestamp: Date.now(),
    });

    if (!isValid) {
      const counterexample: Counterexample = {
        stepIndex: this.trace.getSteps().length - 1,
        currentState: fromState,
        receivedEvent: event,
        expectedEvents: this.automaton.getExpectedEvents(fromState),
      };
      return { isValid: false, fromState, toState: fromState, counterexample };
    }

    this.currentState = nextState;
    return { isValid: true, fromState, toState: nextState };
  }

  /** 重新開始這個流程（例如展示完 REJECT 後想重跑一次合法流程）。 */
  reset(): void {
    this.currentState = this.automaton.initialState;
    this.trace.reset();
  }
}
