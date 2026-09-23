import { Entity } from "./entity";
import { buildCharacterSpriteSet, NPC_PALETTES, PLAYER_PALETTE } from "./pixelSprite";
import type { NpcSpawn } from "./campusMapData";
import type { TimePeriod } from "./timeSystem";

/**
 * NPC 出現規則的純函式版本（計畫書 9.1 節），跟 Npc class 分開方便單元測試：
 * 固定時段型比對目前時段是否落在允許範圍，遊走型則用機率擲骰。
 */
export function computeNpcPresence(
  kind: NpcSpawn["kind"],
  currentPeriod: TimePeriod,
  availablePeriods: TimePeriod[] | undefined,
  appearChance: number,
  random: () => number = Math.random
): boolean {
  return kind === "fixed"
    ? !availablePeriods || availablePeriods.includes(currentPeriod)
    : random() < appearChance;
}

/**
 * 地圖上的 NPC。出現與否交由 Game Layer 透過 refreshPresence() 驅動（計畫書 9.1 / 9.4 節）：
 * 固定時段型比對目前時段，遊走型則是每次時段切換重新擲一次機率，兩者都只影響 isPresent，
 * 不會產生任何 Verification Engine 要處理的新語言結構（見第 9.2 節分工原則）。
 */
export class Npc extends Entity {
  readonly id: string;
  readonly name: string;
  readonly kind: NpcSpawn["kind"];
  readonly locationLabel: string;
  readonly greeting: string;
  private readonly availablePeriods?: TimePeriod[];
  private readonly appearChance: number;
  isPresent = true;

  constructor(spawn: NpcSpawn) {
    const palette = NPC_PALETTES[spawn.paletteKey] ?? PLAYER_PALETTE;
    super(spawn.x, spawn.y, buildCharacterSpriteSet(palette));
    this.id = spawn.id;
    this.name = spawn.name;
    this.kind = spawn.kind;
    this.availablePeriods = spawn.availablePeriods;
    this.appearChance = spawn.appearChance ?? 0.5;
    this.locationLabel = spawn.locationLabel;
    this.greeting = spawn.greeting;
    this.direction = spawn.direction;
  }

  /** 依目前時段重新計算是否在場；wandering 型每次呼叫都會重新擲一次機率。 */
  refreshPresence(currentPeriod: TimePeriod): void {
    this.isPresent = computeNpcPresence(
      this.kind,
      currentPeriod,
      this.availablePeriods,
      this.appearChance
    );
  }
}
