import { eventsOfStep, type QuestDefinition } from "../quest/questManager";
import type { Verifier } from "../verification/verifier";

/**
 * Quest 進度面板（計畫書第 16 節相關 UI）。
 * 用「這個事件有沒有出現在合法 Trace 裡」來判斷完成度，而不是用 state 在 states
 * 陣列裡的 index —— 這樣不管 quest 背後是單純 DFA、還是從 NFA 編譯出來的 DFA
 * （state 可能是好幾個 NFA state 合併出來的集合），面板邏輯都不用改。
 */
export class QuestPanel {
  private readonly nameEl: HTMLElement;
  private readonly switchHintEl: HTMLElement;
  private readonly listEl: HTMLElement;

  constructor() {
    const nameEl = document.getElementById("quest-name");
    const switchHintEl = document.getElementById("quest-switch-hint");
    const listEl = document.getElementById("quest-steps");
    if (!nameEl || !switchHintEl || !listEl) {
      throw new Error("找不到 Quest Panel 的 DOM 元素，請確認 index.html 結構");
    }
    this.nameEl = nameEl;
    this.switchHintEl = switchHintEl;
    this.listEl = listEl;
  }

  render(
    quest: QuestDefinition,
    verifier: Verifier,
    questIndex: number,
    questCount: number,
    stepLocations: Record<string, string[]> = {}
  ): void {
    this.nameEl.textContent = quest.name;
    this.switchHintEl.textContent =
      questCount > 1 ? `按 Q 切換任務（${questIndex + 1} / ${questCount}）` : "";

    const completedEvents = new Set(
      verifier
        .getTrace()
        .getSteps()
        .filter((step) => step.isValid)
        .map((step) => step.event)
    );
    const expectedEvents = new Set(verifier.getExpectedEvents());

    this.listEl.innerHTML = "";
    for (const step of quest.displaySteps) {
      const li = document.createElement("li");
      const events = eventsOfStep(step);
      const label = typeof step === "string" ? quest.eventLabels[step] ?? step : step.label;
      if (events.some((event) => completedEvents.has(event))) {
        li.textContent = `✓ ${label}`;
        li.className = "step-done";
      } else if (events.some((event) => expectedEvents.has(event))) {
        li.textContent = `▶ ${label}`;
        li.className = "step-current";
      } else {
        li.textContent = `○ ${label}`;
        li.className = "step-pending";
      }
      // 多選一的步驟、或同一件事可以在好幾個地方做（例如成績單），每個地點各列一行
      const locations = [...new Set(events.flatMap((event) => stepLocations[event] ?? []))];
      for (const location of locations) {
        const locationEl = document.createElement("span");
        locationEl.className = "step-location";
        locationEl.textContent = location;
        li.appendChild(locationEl);
      }
      this.listEl.appendChild(li);
    }
  }
}
