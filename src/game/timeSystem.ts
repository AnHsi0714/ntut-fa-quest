/**
 * 時間系統（計畫書第 9.4 節）：管理目前時段，並提供「固定時段型 NPC 現在是否該出現」的判斷。
 * 時間本身完全是 Game Layer 的概念，不會進入 Verification Engine（見第 9.2 節的分工原則）。
 */
export type TimePeriod = "morning" | "noon" | "afternoon" | "evening";

const PERIOD_ORDER: TimePeriod[] = ["morning", "noon", "afternoon", "evening"];

export const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  morning: "早上",
  noon: "中午",
  afternoon: "下午",
  evening: "晚上",
};

export class TimeSystem {
  private periodIndex = 0;

  get currentPeriod(): TimePeriod {
    return PERIOD_ORDER[this.periodIndex];
  }

  /** 跳轉到下一個時段（超過晚上會循環回早上）。 */
  advanceToNextPeriod(): TimePeriod {
    this.periodIndex = (this.periodIndex + 1) % PERIOD_ORDER.length;
    return this.currentPeriod;
  }

  /** 固定時段型 NPC 是否該在目前時段出現；沒有限定時段（undefined）代表整天都在。 */
  isWithinPeriods(periods: TimePeriod[] | undefined): boolean {
    return !periods || periods.includes(this.currentPeriod);
  }
}
