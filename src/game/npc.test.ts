import { describe, expect, it } from "vitest";
import { computeNpcPresence, pickNextDestination } from "./npc";

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

describe("pickNextDestination（走動型 NPC 挑下一個目的地）", () => {
  const destinations = [
    { x: 1, y: 1 },
    { x: 5, y: 1 },
    { x: 9, y: 1 },
  ];

  it("不會挑目前所在的位置", () => {
    for (const r of [0, 0.4, 0.99]) {
      expect(pickNextDestination(destinations, { x: 5, y: 1 }, () => r)).not.toEqual({ x: 5, y: 1 });
    }
  });

  it("依亂數在其他目的地之間挑選", () => {
    expect(pickNextDestination(destinations, { x: 5, y: 1 }, () => 0)).toEqual({ x: 1, y: 1 });
    expect(pickNextDestination(destinations, { x: 5, y: 1 }, () => 0.99)).toEqual({ x: 9, y: 1 });
  });

  it("只有一個目的地而且已經站在上面時，不用走", () => {
    expect(pickNextDestination([{ x: 1, y: 1 }], { x: 1, y: 1 })).toBeUndefined();
  });
});
