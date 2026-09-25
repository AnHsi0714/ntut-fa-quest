/**
 * 建築物內換樓層的成本：爬樓梯比較累但不用等，搭電梯幾乎不累但要等電梯，而且坐越多層越久。
 * 兩種方式都只是 Game Layer 的體力 / 時間消耗，不會產生任何 Verification Engine 的事件。
 */
export type VerticalMode = "stairs" | "elevator";

/** 爬樓梯：每層消耗的體力與時間（分鐘）。 */
export const STAIRS_STAMINA_PER_FLOOR = 4;
export const STAIRS_MINUTES_PER_FLOOR = 1;
/** 搭電梯：不論幾層都只消耗少量體力；時間 = 等電梯的固定時間 + 每 2 層多 1 分鐘（無條件進位）。 */
export const ELEVATOR_STAMINA_COST = 1;
export const ELEVATOR_WAIT_MINUTES = 2;
export const ELEVATOR_FLOORS_PER_MINUTE = 2;

export interface VerticalTravelCost {
  stamina: number;
  minutes: number;
}

/** 兩個樓層之間隔了幾層；樓層編號沒有 0，所以 B1 到 1F 只算一層。 */
export function floorsBetween(fromFloor: number, toFloor: number): number {
  const crossesGround = (fromFloor < 0 && toFloor > 0) || (fromFloor > 0 && toFloor < 0);
  return Math.abs(toFloor - fromFloor) - (crossesGround ? 1 : 0);
}

export function computeVerticalTravelCost(
  mode: VerticalMode,
  fromFloor: number,
  toFloor: number
): VerticalTravelCost {
  const floors = floorsBetween(fromFloor, toFloor);
  if (floors === 0) return { stamina: 0, minutes: 0 };
  if (mode === "stairs") {
    return {
      stamina: floors * STAIRS_STAMINA_PER_FLOOR,
      minutes: floors * STAIRS_MINUTES_PER_FLOOR,
    };
  }
  return {
    stamina: ELEVATOR_STAMINA_COST,
    minutes: ELEVATOR_WAIT_MINUTES + Math.ceil(floors / ELEVATOR_FLOORS_PER_MINUTE),
  };
}

export const VERTICAL_MODE_LABELS: Record<VerticalMode, string> = {
  stairs: "樓梯",
  elevator: "電梯",
};
