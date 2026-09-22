import { Entity } from "./entity";
import { buildCharacterSpriteSet, NPC_PALETTES, PLAYER_PALETTE } from "./pixelSprite";
import type { NpcSpawn } from "./campusMapData";

/**
 * 地圖上的 NPC。目前框架版本只支援固定站立，
 * 「遊走 / 隨機出現」邏輯（計畫書 9.1 / 9.4 節）留待時間系統實作時再接上 kind === "wandering" 的分支。
 */
export class Npc extends Entity {
  readonly id: string;
  readonly name: string;
  readonly kind: NpcSpawn["kind"];
  readonly locationLabel: string;
  readonly greeting: string;
  /** 對應計畫書 9.1 節：固定時段型 NPC 是否目前在場（框架版本先固定為 true）。 */
  isPresent = true;

  constructor(spawn: NpcSpawn) {
    const palette = NPC_PALETTES[spawn.paletteKey] ?? PLAYER_PALETTE;
    super(spawn.x, spawn.y, buildCharacterSpriteSet(palette));
    this.id = spawn.id;
    this.name = spawn.name;
    this.kind = spawn.kind;
    this.locationLabel = spawn.locationLabel;
    this.greeting = spawn.greeting;
    this.direction = spawn.direction;
  }
}
