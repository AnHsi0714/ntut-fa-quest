import { describe, expect, it } from "vitest";
import { NFA } from "./NFA";
import { nfaToDfa } from "./nfaToDfa";
import type { DFA } from "./DFA";
import type { EventSymbol } from "./transition";

// 對應 questData.json 文件 B：系辦、系主任皆須完成，順序不限。
function buildDocumentBNfa(): NFA {
  return new NFA(
    ["start", "advisor", "hyp_dept_first", "hyp_head_first", "wait_head", "wait_dept", "ready", "complete"],
    ["visit_advisor", "visit_department", "visit_departmentHead", "submit_document"],
    [
      { from: "start", event: "visit_advisor", to: ["advisor"] },
      { from: "hyp_dept_first", event: "visit_department", to: ["wait_head"] },
      { from: "wait_head", event: "visit_departmentHead", to: ["ready"] },
      { from: "hyp_head_first", event: "visit_departmentHead", to: ["wait_dept"] },
      { from: "wait_dept", event: "visit_department", to: ["ready"] },
      { from: "ready", event: "submit_document", to: ["complete"] },
    ],
    [
      { from: "advisor", to: "hyp_dept_first" },
      { from: "advisor", to: "hyp_head_first" },
    ],
    "start",
    ["complete"]
  );
}

/** 分別在 NFA（走 ε-closure + 多重 state）與轉換後的 DFA 上模擬同一個 trace，回傳是否 ACCEPT。 */
function runOnNfa(nfa: NFA, trace: EventSymbol[]): boolean {
  let current = nfa.epsilonClosure([nfa.initialState]);
  for (const event of trace) {
    const reached = new Set<string>();
    for (const state of current) {
      for (const next of nfa.getNextStates(state, event)) reached.add(next);
    }
    if (reached.size === 0) return false;
    current = nfa.epsilonClosure(reached);
  }
  return [...current].some((state) => nfa.acceptingStates.includes(state));
}

function runOnDfa(dfa: DFA, trace: EventSymbol[]): boolean {
  let current = dfa.initialState;
  for (const event of trace) {
    const next = dfa.getNextState(current, event);
    if (next === null) return false;
    current = next;
  }
  return dfa.isAccepting(current);
}

describe("nfaToDfa (subset construction)", () => {
  const nfa = buildDocumentBNfa();
  const dfa = nfaToDfa(nfa);

  it("產生的 DFA 是單一起始 state、每個 (state, event) 至多一個 transition", () => {
    expect(typeof dfa.initialState).toBe("string");
    const seen = new Set<string>();
    for (const t of dfa.transitions) {
      const key = `${t.from}|${t.event}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("DFA 的 state 數量會少於等於 NFA 的 2^n 個子集合上限（比較 NFA 與 DFA 狀態數）", () => {
    expect(dfa.states.length).toBeGreaterThan(0);
    expect(dfa.states.length).toBeLessThanOrEqual(2 ** nfa.states.length);
    // subset construction 只會建立實際可達的子集合，遠小於暴力列舉全部子集合。
    expect(dfa.states.length).toBeLessThan(nfa.states.length);
  });

  const legalOrderDeptFirst = [
    "visit_advisor",
    "visit_department",
    "visit_departmentHead",
    "submit_document",
  ];
  const legalOrderHeadFirst = [
    "visit_advisor",
    "visit_departmentHead",
    "visit_department",
    "submit_document",
  ];
  const illegalSkipHead = ["visit_advisor", "visit_department", "submit_document"];
  const illegalWrongStart = ["submit_document"];

  it.each([
    ["先系辦後系主任", legalOrderDeptFirst, true],
    ["先系主任後系辦", legalOrderHeadFirst, true],
    ["跳過系主任直接送出", illegalSkipHead, false],
    ["一開始就送出文件", illegalWrongStart, false],
  ] as const)("NFA 與轉換後的 DFA 對同一個 trace（%s）結果一致", (_label, trace, expected) => {
    const nfaResult = runOnNfa(nfa, [...trace]);
    const dfaResult = runOnDfa(dfa, [...trace]);
    expect(nfaResult).toBe(expected);
    expect(dfaResult).toBe(expected);
  });
});
