import { TIME_PERIOD_LABELS, formatClock, type TimePeriod } from "../game/timeSystem";

export interface StatusBarInput {
  day: number;
  minutesOfDay: number;
  period: TimePeriod;
  stamina: number;
  maxStamina: number;
  location: string;
  /** 手上印好的文件，例如「申請單 1 份、成績單 1 份」；沒有就是空字串。 */
  items: string;
  /** 是否按住 Shift 跑步中；純比較移動速度不容易感覺出來，額外用文字提示確認。 */
  running: boolean;
}

/** 狀態列 UI（計畫書 9.4 / 9.5 節）：顯示第幾天、目前時間與時段、體力，以及玩家所在位置。 */
export class StatusBar {
  private readonly timeEl: HTMLElement;
  private readonly staminaEl: HTMLElement;
  private readonly locationEl: HTMLElement;
  private readonly runEl: HTMLElement;

  constructor() {
    const timeEl = document.getElementById("status-time");
    const staminaEl = document.getElementById("status-stamina");
    const locationEl = document.getElementById("status-location");
    const runEl = document.getElementById("status-run");
    if (!timeEl || !staminaEl || !locationEl || !runEl) {
      throw new Error("找不到狀態列的 DOM 元素，請確認 index.html 結構");
    }
    this.timeEl = timeEl;
    this.staminaEl = staminaEl;
    this.locationEl = locationEl;
    this.runEl = runEl;
  }

  /** 時間每一幀都在走，只有文字真的改變時才寫進 DOM。 */
  render(input: StatusBarInput): void {
    setText(
      this.timeEl,
      `第 ${input.day} 天 ${formatClock(input.minutesOfDay)}（${TIME_PERIOD_LABELS[input.period]}）`
    );
    setText(this.staminaEl, `體力：${Math.ceil(input.stamina)} / ${input.maxStamina}`);
    this.runEl.classList.toggle("hidden", !input.running);
    setText(
      this.locationEl,
      input.items ? `位置：${input.location}｜持有：${input.items}` : `位置：${input.location}`
    );
  }
}

function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}
