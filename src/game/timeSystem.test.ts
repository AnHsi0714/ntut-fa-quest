import { describe, expect, it } from "vitest";
import { CURFEW_MINUTES, DAY_START_MINUTES, TimeSystem, formatClock, periodAt } from "./timeSystem";

describe("TimeSystem", () => {
  it("預設從第 1 天早上 8:00 開始", () => {
    const time = new TimeSystem();
    expect(time.day).toBe(1);
    expect(time.minutesOfDay).toBe(DAY_START_MINUTES);
    expect(time.currentPeriod).toBe("morning");
    expect(time.isCurfew).toBe(false);
  });

  it("periodAt：依時鐘推導時段", () => {
    expect(periodAt(8 * 60)).toBe("morning");
    expect(periodAt(11 * 60 + 59)).toBe("morning");
    expect(periodAt(12 * 60)).toBe("noon");
    expect(periodAt(13 * 60)).toBe("afternoon");
    expect(periodAt(17 * 60)).toBe("evening");
    expect(periodAt(19 * 60 + 59)).toBe("evening");
  });

  it("formatClock：格式化成 HH:MM，小數分鐘無條件捨去", () => {
    expect(formatClock(8 * 60)).toBe("08:00");
    expect(formatClock(13 * 60 + 5.9)).toBe("13:05");
  });

  it("advanceMinutes：跨越時段邊界時回傳 true", () => {
    const time = new TimeSystem();
    expect(time.advanceMinutes(30)).toBe(false);
    expect(time.advanceMinutes(4 * 60)).toBe(true);
    expect(time.currentPeriod).toBe("noon");
  });

  it("advanceMinutes：最多只會走到晚上 8:00，並進入閉校狀態", () => {
    const time = new TimeSystem();
    time.advanceMinutes(24 * 60);
    expect(time.minutesOfDay).toBe(CURFEW_MINUTES);
    expect(time.isCurfew).toBe(true);
  });

  it("advanceToNextPeriod：依序跳到下一個時段開頭，晚上再跳就是閉校", () => {
    const time = new TimeSystem();
    time.advanceMinutes(15);
    time.advanceToNextPeriod();
    expect(time.minutesOfDay).toBe(12 * 60);
    time.advanceToNextPeriod();
    expect(time.currentPeriod).toBe("afternoon");
    time.advanceToNextPeriod();
    expect(time.currentPeriod).toBe("evening");
    time.advanceToNextPeriod();
    expect(time.isCurfew).toBe(true);
  });

  it("startNextDay：日數加一、時鐘回到早上 8:00", () => {
    const time = new TimeSystem();
    time.advanceMinutes(24 * 60);
    time.startNextDay();
    expect(time.day).toBe(2);
    expect(time.minutesOfDay).toBe(DAY_START_MINUTES);
    expect(time.isCurfew).toBe(false);
  });

  it("isWithinPeriods：沒有限定時段代表整天都在，否則只看目前時段", () => {
    const time = new TimeSystem();
    expect(time.isWithinPeriods(undefined)).toBe(true);
    expect(time.isWithinPeriods(["afternoon"])).toBe(false);
    time.advanceMinutes(5 * 60);
    expect(time.isWithinPeriods(["afternoon"])).toBe(true);
  });
});
