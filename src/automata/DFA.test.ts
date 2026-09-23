import { describe, expect, it } from "vitest";
import { DFA } from "./DFA";

describe("DFA", () => {
  const dfa = new DFA(
    ["start", "advisor", "department", "complete"],
    ["visit_advisor", "visit_department", "submit_document"],
    [
      { from: "start", event: "visit_advisor", to: "advisor" },
      { from: "advisor", event: "visit_department", to: "department" },
      { from: "department", event: "submit_document", to: "complete" },
    ],
    "start",
    ["complete"]
  );

  it("跟著合法 transition 前進到下一個 state", () => {
    expect(dfa.getNextState("start", "visit_advisor")).toBe("advisor");
    expect(dfa.getNextState("advisor", "visit_department")).toBe("department");
  });

  it("沒有定義的 transition 回傳 null（Invalid Transition）", () => {
    expect(dfa.getNextState("start", "submit_document")).toBeNull();
    expect(dfa.getNextState("advisor", "visit_advisor")).toBeNull();
  });

  it("getExpectedEvents 回傳目前 state 底下所有合法事件", () => {
    expect(dfa.getExpectedEvents("advisor")).toEqual(["visit_department"]);
    expect(dfa.getExpectedEvents("complete")).toEqual([]);
  });

  it("isAccepting 只對 accepting state 回傳 true", () => {
    expect(dfa.isAccepting("complete")).toBe(true);
    expect(dfa.isAccepting("advisor")).toBe(false);
  });
});
