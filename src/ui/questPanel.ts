import type { QuestDefinition } from "../quest/questManager";

/** Quest 進度面板（計畫書第 16 節相關 UI）：把 Document A 的線性流程畫成步驟清單。 */
export class QuestPanel {
  private readonly nameEl: HTMLElement;
  private readonly listEl: HTMLElement;

  constructor() {
    const nameEl = document.getElementById("quest-name");
    const listEl = document.getElementById("quest-steps");
    if (!nameEl || !listEl) {
      throw new Error("找不到 Quest Panel 的 DOM 元素，請確認 index.html 結構");
    }
    this.nameEl = nameEl;
    this.listEl = listEl;
  }

  render(quest: QuestDefinition, currentState: string): void {
    this.nameEl.textContent = quest.name;

    const currentIndex = quest.states.indexOf(currentState);
    this.listEl.innerHTML = "";
    quest.transitions.forEach(([, event], index) => {
      const li = document.createElement("li");
      const label = quest.eventLabels[event] ?? event;
      if (index < currentIndex) {
        li.textContent = `✓ ${label}`;
        li.className = "step-done";
      } else if (index === currentIndex) {
        li.textContent = `▶ ${label}`;
        li.className = "step-current";
      } else {
        li.textContent = `○ ${label}`;
        li.className = "step-pending";
      }
      this.listEl.appendChild(li);
    });
  }
}
