import { describe, expect, it } from "vitest";
import {
  ELEVATOR_STAMINA_COST,
  ELEVATOR_WAIT_MINUTES,
  STAIRS_MINUTES_PER_FLOOR,
  STAIRS_STAMINA_PER_FLOOR,
  computeVerticalTravelCost,
  floorsBetween,
} from "./verticalTravel";

describe("computeVerticalTravelCost", () => {
  it("樓梯：依樓層數累加體力與時間，上樓下樓一樣", () => {
    expect(computeVerticalTravelCost("stairs", 1, 3)).toEqual({
      stamina: 2 * STAIRS_STAMINA_PER_FLOOR,
      minutes: 2 * STAIRS_MINUTES_PER_FLOOR,
    });
    expect(computeVerticalTravelCost("stairs", 4, 1)).toEqual({
      stamina: 3 * STAIRS_STAMINA_PER_FLOOR,
      minutes: 3 * STAIRS_MINUTES_PER_FLOOR,
    });
  });

  it("電梯：體力固定，時間是等電梯的固定時間加上每 2 層 1 分鐘（進位）", () => {
    expect(computeVerticalTravelCost("elevator", 1, 2)).toEqual({
      stamina: ELEVATOR_STAMINA_COST,
      minutes: ELEVATOR_WAIT_MINUTES + 1,
    });
    expect(computeVerticalTravelCost("elevator", 1, 12)).toEqual({
      stamina: ELEVATOR_STAMINA_COST,
      minutes: ELEVATOR_WAIT_MINUTES + 6,
    });
  });

  it("電梯坐越多層等越久", () => {
    const short = computeVerticalTravelCost("elevator", 1, 3);
    const long = computeVerticalTravelCost("elevator", 1, 16);
    expect(long.minutes).toBeGreaterThan(short.minutes);
  });

  it("只差一層時走樓梯比較快，差很多層時搭電梯比較快", () => {
    expect(computeVerticalTravelCost("stairs", 1, 2).minutes).toBeLessThan(
      computeVerticalTravelCost("elevator", 1, 2).minutes
    );
    expect(computeVerticalTravelCost("elevator", 1, 16).minutes).toBeLessThan(
      computeVerticalTravelCost("stairs", 1, 16).minutes
    );
  });

  it("爬兩層以上時，樓梯比電梯耗體力", () => {
    const stairs = computeVerticalTravelCost("stairs", 1, 3);
    const elevator = computeVerticalTravelCost("elevator", 1, 3);
    expect(stairs.stamina).toBeGreaterThan(elevator.stamina);
  });

  it("floorsBetween：沒有 0 樓，B1 到 1F 只算一層", () => {
    expect(floorsBetween(-1, 1)).toBe(1);
    expect(floorsBetween(-4, 7)).toBe(10);
    expect(floorsBetween(3, 1)).toBe(2);
    expect(floorsBetween(-4, -1)).toBe(3);
  });

  it("樓梯走到地下室也照層數計算", () => {
    expect(computeVerticalTravelCost("stairs", 1, -4).stamina).toBe(4 * STAIRS_STAMINA_PER_FLOOR);
  });

  it("同一層不需要任何成本", () => {
    expect(computeVerticalTravelCost("stairs", 2, 2)).toEqual({ stamina: 0, minutes: 0 });
    expect(computeVerticalTravelCost("elevator", 2, 2)).toEqual({ stamina: 0, minutes: 0 });
  });
});
