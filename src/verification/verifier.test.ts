import { describe, expect, it } from "vitest";
import { Verifier } from "./verifier";
import { buildAutomatonForQuest, type QuestDefinition } from "../quest/questManager";
import questData from "../quest/questData.json";

const quests = questData as unknown as QuestDefinition[];

function getQuest(id: string): QuestDefinition {
  const quest = quests.find((q) => q.id === id);
  if (!quest) throw new Error(`quest not found: ${id}`);
  return quest;
}

describe("Verifier + 文件 A（DFA，固定順序流程）", () => {
  const documentA = getQuest("document-a");

  it("依序完成合法流程 => ACCEPT", () => {
    const verifier = new Verifier(buildAutomatonForQuest(documentA));
    for (const event of documentA.displaySteps) {
      const outcome = verifier.handleEvent(event);
      expect(outcome.isValid).toBe(true);
    }
    expect(verifier.isAccepted()).toBe(true);
  });

  it("跳過必要步驟（略過系辦直接送出文件）=> REJECT，並附上正確 Counterexample", () => {
    const verifier = new Verifier(buildAutomatonForQuest(documentA));
    verifier.handleEvent("visit_advisor");
    const outcome = verifier.handleEvent("submit_document");

    expect(outcome.isValid).toBe(false);
    expect(verifier.isAccepted()).toBe(false);
    expect(outcome.counterexample?.currentState).toBe("advisor");
    expect(outcome.counterexample?.receivedEvent).toBe("submit_document");
    expect(outcome.counterexample?.expectedEvents).toEqual(["visit_department"]);
  });

  it("提前提交文件（一開始就 submit_document）=> REJECT", () => {
    const verifier = new Verifier(buildAutomatonForQuest(documentA));
    const outcome = verifier.handleEvent("submit_document");
    expect(outcome.isValid).toBe(false);
  });

  it("錯誤順序（先系辦再拜訪老師）=> REJECT", () => {
    const verifier = new Verifier(buildAutomatonForQuest(documentA));
    const outcome = verifier.handleEvent("visit_department");
    expect(outcome.isValid).toBe(false);
    expect(outcome.counterexample?.expectedEvents).toEqual(["visit_advisor"]);
  });

  it("不合法重複操作（已離開 start 後又觸發已經不合法的 visit_advisor）=> REJECT，不需要額外建模非法 Loop", () => {
    const verifier = new Verifier(buildAutomatonForQuest(documentA));
    verifier.handleEvent("visit_advisor");
    verifier.handleEvent("visit_department");
    const outcome = verifier.handleEvent("visit_advisor");

    expect(outcome.isValid).toBe(false);
    expect(verifier.getCurrentState()).toBe("department");
    const steps = verifier.getTrace().getSteps();
    expect(steps).toHaveLength(3);
    expect(steps[2].isValid).toBe(false);
  });

  it("REJECT 之後玩家仍可以補做正確步驟完成流程（事後驗證，不卡死玩家）", () => {
    const verifier = new Verifier(buildAutomatonForQuest(documentA));
    verifier.handleEvent("visit_advisor");
    verifier.handleEvent("submit_document"); // 走錯，REJECT 但不卡住
    expect(verifier.isAccepted()).toBe(false);

    verifier.handleEvent("visit_department");
    verifier.handleEvent("submit_document");
    expect(verifier.isAccepted()).toBe(true);
  });
});

describe("Verifier + 文件 A 的撲空（計畫書 9.3 節：不建 Waiting State，沿用未定義 transition → REJECT）", () => {
  const documentA = getQuest("document-a");

  it("撲空（staff_absent）沒有對應 transition => REJECT，但 state 留在原地，玩家隨時可以再試", () => {
    const verifier = new Verifier(buildAutomatonForQuest(documentA));
    const outcome = verifier.handleEvent("staff_absent");

    expect(outcome.isValid).toBe(false);
    expect(verifier.getCurrentState()).toBe("start");
    expect(outcome.counterexample?.expectedEvents).toEqual(["visit_advisor"]);

    // 撲空這筆依然會如實留在 Trace 上（isValid: false），方便 UI 顯示「這裡曾經撲空過」，
    // 不需要額外的 state 來達成同樣的效果。
    const events = verifier.getTrace().getSteps().map((step) => step.event);
    expect(events).toEqual(["staff_absent"]);
  });

  it("撲空之後，老師實際在場時直接送 visit_advisor 就能繼續，不需要額外的「回來了」事件", () => {
    const verifier = new Verifier(buildAutomatonForQuest(documentA));
    verifier.handleEvent("staff_absent"); // REJECT，state 仍是 start
    verifier.handleEvent("visit_advisor");
    verifier.handleEvent("visit_department");
    verifier.handleEvent("submit_document");
    expect(verifier.isAccepted()).toBe(true);
  });
});

describe("Verifier + 文件 B（NFA → DFA，系辦與系主任順序不限）", () => {
  const documentB = getQuest("document-b");

  it("先系辦後系主任 => ACCEPT", () => {
    const verifier = new Verifier(buildAutomatonForQuest(documentB));
    for (const event of ["visit_advisor", "visit_department", "visit_departmentHead", "submit_document"]) {
      expect(verifier.handleEvent(event).isValid).toBe(true);
    }
    expect(verifier.isAccepted()).toBe(true);
  });

  it("先系主任後系辦 => ACCEPT（驗證 NFA 轉換出的 DFA 對兩種順序結果一致）", () => {
    const verifier = new Verifier(buildAutomatonForQuest(documentB));
    for (const event of ["visit_advisor", "visit_departmentHead", "visit_department", "submit_document"]) {
      expect(verifier.handleEvent(event).isValid).toBe(true);
    }
    expect(verifier.isAccepted()).toBe(true);
  });

  it("只完成系辦、跳過系主任就送出 => REJECT", () => {
    const verifier = new Verifier(buildAutomatonForQuest(documentB));
    verifier.handleEvent("visit_advisor");
    verifier.handleEvent("visit_department");
    const outcome = verifier.handleEvent("submit_document");

    expect(outcome.isValid).toBe(false);
    expect(verifier.isAccepted()).toBe(false);
  });
});
