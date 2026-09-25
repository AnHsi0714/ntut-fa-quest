/**
 * 時間系統（計畫書第 9.4 節）：以「一天中的第幾分鐘」管理遊戲內時鐘，時間會隨真實時間持續流逝，
 * 每天從早上 8:00 開始，到晚上 8:00（閉校）為止；閉校後由 Game Layer 把玩家送回校門口、開始下一天。
 * 時段（早上 / 中午 / 下午 / 晚上）由時鐘推導，用來判斷固定時段型 NPC 是否該出現。
 * 時間本身完全是 Game Layer 的概念，不會進入 Verification Engine（見第 9.2 節的分工原則）。
 */
export type TimePeriod = "morning" | "noon" | "afternoon" | "evening";

export const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  morning: "早上",
  noon: "中午",
  afternoon: "下午",
  evening: "晚上",
};

/** 每天開始的時間：早上 8:00（以一天中的第幾分鐘表示）。 */
export const DAY_START_MINUTES = 8 * 60;
/** 閉校時間：晚上 8:00，時鐘走到這裡就會觸發「送回校門口」。 */
export const CURFEW_MINUTES = 20 * 60;

/** 各時段的起始時間，依時間先後排列。 */
const PERIOD_STARTS: Array<{ period: TimePeriod; start: number }> = [
  { period: "morning", start: DAY_START_MINUTES },
  { period: "noon", start: 12 * 60 },
  { period: "afternoon", start: 13 * 60 },
  { period: "evening", start: 17 * 60 },
];

export function periodAt(minutesOfDay: number): TimePeriod {
  let current: TimePeriod = PERIOD_STARTS[0].period;
  for (const { period, start } of PERIOD_STARTS) {
    if (minutesOfDay >= start) current = period;
  }
  return current;
}

/** 把「一天中的第幾分鐘」格式化成 HH:MM。 */
export function formatClock(minutesOfDay: number): string {
  const total = Math.floor(minutesOfDay);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export class TimeSystem {
  /** 可以是小數：真實時間每一幀推進的量通常不到一分鐘。 */
  private minutes = DAY_START_MINUTES;
  private dayNumber = 1;

  get minutesOfDay(): number {
    return this.minutes;
  }

  get day(): number {
    return this.dayNumber;
  }

  get currentPeriod(): TimePeriod {
    return periodAt(this.minutes);
  }

  /** 時鐘已經走到晚上 8:00，等待 Game Layer 把玩家送回校門口。 */
  get isCurfew(): boolean {
    return this.minutes >= CURFEW_MINUTES;
  }

  /** 讓時間往前流逝，最多走到閉校時間為止。回傳時段是否因此切換（用來重新計算 NPC 在場狀態）。 */
  advanceMinutes(amount: number): boolean {
    const before = this.currentPeriod;
    this.minutes = Math.min(CURFEW_MINUTES, this.minutes + Math.max(0, amount));
    return this.currentPeriod !== before;
  }

  /** 跳轉到下一個時段的開頭；已經是晚上的話，就直接跳到閉校時間。 */
  advanceToNextPeriod(): void {
    const next = PERIOD_STARTS.find(({ start }) => start > this.minutes);
    this.minutes = next ? next.start : CURFEW_MINUTES;
  }

  /** 閉校後開始新的一天：日數加一，時鐘回到早上 8:00。 */
  startNextDay(): void {
    this.dayNumber += 1;
    this.minutes = DAY_START_MINUTES;
  }

  /** 固定時段型 NPC 是否該在目前時段出現；沒有限定時段（undefined）代表整天都在。 */
  isWithinPeriods(periods: TimePeriod[] | undefined): boolean {
    return !periods || periods.includes(this.currentPeriod);
  }
}
