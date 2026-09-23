import { TIME_PERIOD_LABELS, type TimePeriod } from "../game/timeSystem";

/** 狀態列 UI（計畫書 9.4 / 9.5 節）：顯示目前時段與體力數值。 */
export class StatusBar {
  private readonly timeEl: HTMLElement;
  private readonly staminaEl: HTMLElement;

  constructor() {
    const timeEl = document.getElementById("status-time");
    const staminaEl = document.getElementById("status-stamina");
    if (!timeEl || !staminaEl) {
      throw new Error("找不到狀態列的 DOM 元素，請確認 index.html 結構");
    }
    this.timeEl = timeEl;
    this.staminaEl = staminaEl;
  }

  render(period: TimePeriod, stamina: number, maxStamina: number): void {
    this.timeEl.textContent = `時段：${TIME_PERIOD_LABELS[period]}`;
    this.staminaEl.textContent = `體力：${stamina} / ${maxStamina}`;
  }
}
