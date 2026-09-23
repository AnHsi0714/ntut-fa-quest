import { describe, expect, it } from "vitest";
import { TimeSystem } from "./timeSystem";

describe("TimeSystem", () => {
  it("預設從早上開始", () => {
    const time = new TimeSystem();
    expect(time.currentPeriod).toBe("morning");
  });

  it("依序推進時段，晚上之後會循環回早上", () => {
    const time = new TimeSystem();
    expect(time.advanceToNextPeriod()).toBe("noon");
    expect(time.advanceToNextPeriod()).toBe("afternoon");
    expect(time.advanceToNextPeriod()).toBe("evening");
    expect(time.advanceToNextPeriod()).toBe("morning");
  });

  it("isWithinPeriods：沒有限定時段代表整天都在", () => {
    const time = new TimeSystem();
    expect(time.isWithinPeriods(undefined)).toBe(true);
  });

  it("isWithinPeriods：只有落在限定時段內才回傳 true", () => {
    const time = new TimeSystem();
    expect(time.isWithinPeriods(["afternoon"])).toBe(false);
    time.advanceToNextPeriod(); // noon
    time.advanceToNextPeriod(); // afternoon
    expect(time.isWithinPeriods(["afternoon"])).toBe(true);
    expect(time.isWithinPeriods(["morning", "evening"])).toBe(false);
  });
});
