/**
 * 時間系統骨架（計畫書第 9.4 節）。
 * 框架版本先定義資料結構與介面，「跳轉時間」對 NPC 出現規則的實際影響留待 Phase 4 後續項目串接。
 */
export type TimePeriod = "morning" | "noon" | "afternoon" | "evening";

const PERIOD_ORDER: TimePeriod[] = ["morning", "noon", "afternoon", "evening"];

export class TimeSystem {
  private periodIndex = 0;

  get currentPeriod(): TimePeriod {
    return PERIOD_ORDER[this.periodIndex];
  }

  /** 跳轉到下一個時段（超過晚上會循環回早上）。TODO：串接固定時段型 NPC 的出現規則。 */
  advanceToNextPeriod(): TimePeriod {
    this.periodIndex = (this.periodIndex + 1) % PERIOD_ORDER.length;
    return this.currentPeriod;
  }
}
