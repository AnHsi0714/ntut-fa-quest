import { describe, expect, it } from "vitest";
import { computeNpcPresence } from "./npc";
import {
  ADVANCE_TIME_STAMINA_COST,
  PROBE_ABSENT_NPC_STAMINA_COST,
  REST_TASK_MINUTES,
} from "./pacing";
import { StaminaSystem } from "./staminaSystem";
import { TimeSystem } from "./timeSystem";

/** 系主任、系上老師都是 50% 的遊走型 NPC（campusMapData.ts）。 */
const WANDERING_CHANCE = 0.5;
/** 一天有早上、中午、下午、晚上四個時段。 */
const PERIODS_PER_DAY = 4;

/** 可重現的亂數（LCG），讓機率測試每次跑出來的結果都一樣。 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * 照 game.ts 的規則模擬一位遊走型 NPC 與玩家的時間 / 體力：
 * 開局、時段切換、閉校隔天時才重新擲骰（refreshNpcPresence），撲空扣體力，體力歸零觸發臨時任務。
 */
class CampingSimulation {
  readonly time = new TimeSystem();
  readonly stamina = new StaminaSystem();
  present = false;
  rolls = 0;
  restTasks = 0;

  constructor(private readonly random: () => number) {
    this.roll();
  }

  private roll(): void {
    this.rolls += 1;
    this.present = computeNpcPresence("wandering", this.time.currentPeriod, undefined, WANDERING_CHANCE, this.random);
  }

  private restIfDepleted(): void {
    if (!this.stamina.isDepleted) return;
    this.restTasks += 1;
    this.stamina.restore(this.stamina.max);
    if (this.time.advanceMinutes(REST_TASK_MINUTES)) this.roll();
  }

  /** 去找 NPC：在就回傳 true；不在就撲空扣體力。 */
  probe(): boolean {
    if (this.present) return true;
    this.stamina.consume(PROBE_ABSENT_NPC_STAMINA_COST);
    this.restIfDepleted();
    return false;
  }

  /** 按 T 跳轉到下一個時段，晚上再跳就閉校、隔天早上重來。 */
  advancePeriod(): void {
    this.stamina.consume(ADVANCE_TIME_STAMINA_COST);
    this.time.advanceToNextPeriod();
    if (this.time.isCurfew) {
      this.time.startNextDay();
      this.stamina.restore(this.stamina.max);
      this.roll();
      return;
    }
    this.roll();
    this.restIfDepleted();
  }

  /** 蹲點策略：撲空就跳下一個時段再試，直到遇到為止。回傳遇到時是第幾天。 */
  campUntilPresent(): number {
    while (!this.probe()) this.advancePeriod();
    return this.time.day;
  }
}

describe("蹲點碰運氣的遊戲節奏（計畫書 9.5 節）", () => {
  it("同一個時段內重複去找不會重新擲骰，只會一直扣體力，最後被臨時任務打斷", () => {
    const sim = new CampingSimulation(() => 0.99); // 一定不在
    const probesUntilDepleted = Math.ceil(sim.stamina.max / PROBE_ABSENT_NPC_STAMINA_COST);

    for (let i = 0; i < probesUntilDepleted - 1; i++) sim.probe();
    expect(sim.rolls).toBe(1);
    expect(sim.restTasks).toBe(0);

    sim.probe();
    expect(sim.restTasks).toBe(1);
    expect(sim.time.minutesOfDay).toBeGreaterThanOrEqual(8 * 60 + REST_TASK_MINUTES);
  });

  it("想重擲只能換時段，一天最多只有 4 次機會，用完就得等到隔天", () => {
    const sim = new CampingSimulation(() => 0.99);
    for (let i = 0; i < PERIODS_PER_DAY - 1; i++) {
      sim.probe();
      sim.advancePeriod();
    }
    expect(sim.time.day).toBe(1);
    expect(sim.rolls).toBe(PERIODS_PER_DAY);

    sim.probe();
    sim.advancePeriod();
    expect(sim.time.day).toBe(2);
  });

  it("每多一次機會至少要付一次撲空加一次跳轉的體力，一整天蹲下來體力會用掉大半", () => {
    const sim = new CampingSimulation(() => 0.99);
    for (let i = 0; i < PERIODS_PER_DAY - 1; i++) {
      sim.probe();
      sim.advancePeriod();
    }
    sim.probe();
    const spent = sim.stamina.max - sim.stamina.current;
    expect(spent).toBe(
      PERIODS_PER_DAY * PROBE_ABSENT_NPC_STAMINA_COST + (PERIODS_PER_DAY - 1) * ADVANCE_TIME_STAMINA_COST
    );
    expect(spent).toBeGreaterThanOrEqual(sim.stamina.max / 2);
  });

  it("50% 的遊走型 NPC 照蹲點策略大多一天內遇得到，不會卡關，也不會一試就中", () => {
    const random = seededRandom(20260926);
    const trials = 2000;
    let foundOnDayOne = 0;
    let totalRolls = 0;
    let worstDay = 0;

    for (let i = 0; i < trials; i++) {
      const sim = new CampingSimulation(random);
      const day = sim.campUntilPresent();
      if (day === 1) foundOnDayOne += 1;
      totalRolls += sim.rolls;
      worstDay = Math.max(worstDay, day);
    }

    // 一天 4 次機會都沒遇到的機率是 0.5^4 = 6.25%。
    expect(foundOnDayOne / trials).toBeCloseTo(1 - (1 - WANDERING_CHANCE) ** PERIODS_PER_DAY, 1);
    // 幾何分布期望值 1 / 0.5 = 2 次擲骰。
    expect(totalRolls / trials).toBeGreaterThan(1.8);
    expect(totalRolls / trials).toBeLessThan(2.2);
    expect(worstDay).toBeLessThanOrEqual(4);
  });
});
