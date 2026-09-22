import type { NFA } from "./NFA";
import type { DFA } from "./DFA";

/**
 * NFA → DFA 轉換骨架（計畫書第 13 節，Subset Construction）。
 * TODO（Phase 2）：實作 ε-closure（若模型需要）與 subset construction，產生對應的 DFA。
 */
export function nfaToDfa(_nfa: NFA): DFA {
  throw new Error("nfaToDfa 尚未實作，見計畫書第 13 節開發項目");
}
