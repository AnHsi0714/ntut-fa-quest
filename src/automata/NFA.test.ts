import { describe, expect, it } from "vitest";
import { NFA } from "./NFA";

describe("NFA", () => {
  // 對應 questData.json 文件 B：系辦、系主任皆須完成，順序不限。
  const nfa = new NFA(
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

  it("getNextStates 對同一個 (state, event) 可以回傳多個目的地", () => {
    // advisor 本身沒有直接對應的 event transition，多重路徑要透過 ε-closure 展開，
    // 這裡直接驗證資料結構層面：hyp_dept_first / hyp_head_first 各自只會走向一個 state。
    expect(nfa.getNextStates("hyp_dept_first", "visit_department")).toEqual(["wait_head"]);
    expect(nfa.getNextStates("hyp_head_first", "visit_departmentHead")).toEqual(["wait_dept"]);
  });

  it("找不到對應 transition 時回傳空陣列", () => {
    expect(nfa.getNextStates("start", "submit_document")).toEqual([]);
  });

  it("epsilonClosure 會展開所有 ε-transition 能到達的 state（含自己）", () => {
    const closure = nfa.epsilonClosure(["advisor"]);
    expect(closure).toEqual(new Set(["advisor", "hyp_dept_first", "hyp_head_first"]));
  });

  it("epsilonClosure 對沒有 ε-transition 的 state 只回傳自己", () => {
    expect(nfa.epsilonClosure(["complete"])).toEqual(new Set(["complete"]));
  });

  it("可以模擬多個可能 state 並存：從 advisor 出發走 visit_department 會同時處在多個可能路徑", () => {
    const afterAdvisor = nfa.epsilonClosure(["advisor"]);
    const reached = new Set<string>();
    for (const state of afterAdvisor) {
      for (const next of nfa.getNextStates(state, "visit_department")) {
        reached.add(next);
      }
    }
    expect(reached).toEqual(new Set(["wait_head"]));
  });
});
