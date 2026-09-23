import { describe, expect, it } from "vitest";
import { computeNpcPresence } from "./npc";

describe("computeNpcPresence（計畫書 9.1 節：固定時段型 / 遊走型 NPC 出現規則）", () => {
  it("固定時段型：沒有限定時段代表整天都在", () => {
    expect(computeNpcPresence("fixed", "morning", undefined, 0.5)).toBe(true);
    expect(computeNpcPresence("fixed", "evening", undefined, 0.5)).toBe(true);
  });

  it("固定時段型：只有落在限定時段內才在場", () => {
    expect(computeNpcPresence("fixed", "afternoon", ["afternoon"], 0.5)).toBe(true);
    expect(computeNpcPresence("fixed", "morning", ["afternoon"], 0.5)).toBe(false);
    expect(computeNpcPresence("fixed", "evening", ["afternoon"], 0.5)).toBe(false);
  });

  it("遊走型：依機率擲骰決定是否在場", () => {
    expect(computeNpcPresence("wandering", "morning", undefined, 0.5, () => 0.4)).toBe(true);
    expect(computeNpcPresence("wandering", "morning", undefined, 0.5, () => 0.6)).toBe(false);
  });
});
