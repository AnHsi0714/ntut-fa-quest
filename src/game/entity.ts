import type { CharacterSpriteSet, Direction } from "./pixelSprite";
import { TILE_SIZE } from "./tileArt";
import type { Camera } from "./camera";

/** 從一格移動到下一格所花費的時間（毫秒），數值越小走路越快。 */
const MOVE_DURATION_MS = 160;
/** 走路動畫兩幀切換的間隔（毫秒）。 */
const WALK_FRAME_INTERVAL_MS = MOVE_DURATION_MS / 2;

const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/**
 * 所有可在地圖上移動的角色（玩家 / NPC）共用的基礎類別。
 * 移動採用「格子鎖定」：一次只往一個方向移動一格，移動中會用 pixelX/pixelY 做平滑補間，
 * 視覺上接近 Pokemon / RPG Maker 的 tile-based 移動手感。
 */
export class Entity {
  tileX: number;
  tileY: number;
  pixelX: number;
  pixelY: number;
  direction: Direction = "down";
  isMoving = false;

  private moveElapsedMs = 0;
  private moveFromX = 0;
  private moveFromY = 0;
  private frameIndex: 0 | 1 = 0;
  private frameElapsedMs = 0;

  constructor(
    tileX: number,
    tileY: number,
    protected readonly spriteSet: CharacterSpriteSet
  ) {
    this.tileX = tileX;
    this.tileY = tileY;
    this.pixelX = tileX * TILE_SIZE;
    this.pixelY = tileY * TILE_SIZE;
  }

  /**
   * 嘗試往指定方向移動一格；若目標格不可走則只轉向、不移動。回傳是否真的開始移動。
   * canEnter 由呼叫端組合地圖可走性與（例如）NPC 佔位檢查，Entity 本身不需要知道地圖或其他角色的細節。
   */
  tryMove(direction: Direction, canEnter: (x: number, y: number) => boolean): boolean {
    this.direction = direction;
    if (this.isMoving) return false;

    const { dx, dy } = DIRECTION_DELTA[direction];
    const targetX = this.tileX + dx;
    const targetY = this.tileY + dy;
    if (!canEnter(targetX, targetY)) {
      return false;
    }

    this.moveFromX = this.tileX;
    this.moveFromY = this.tileY;
    this.tileX = targetX;
    this.tileY = targetY;
    this.isMoving = true;
    this.moveElapsedMs = 0;
    return true;
  }

  /** 面向目標格但不實際移動（例如互動前先轉向）。 */
  faceTowards(direction: Direction): void {
    if (!this.isMoving) {
      this.direction = direction;
    }
  }

  update(deltaMs: number): void {
    if (this.isMoving) {
      this.moveElapsedMs += deltaMs;
      const t = Math.min(1, this.moveElapsedMs / MOVE_DURATION_MS);
      this.pixelX = lerp(this.moveFromX * TILE_SIZE, this.tileX * TILE_SIZE, t);
      this.pixelY = lerp(this.moveFromY * TILE_SIZE, this.tileY * TILE_SIZE, t);

      this.frameElapsedMs += deltaMs;
      if (this.frameElapsedMs >= WALK_FRAME_INTERVAL_MS) {
        this.frameElapsedMs = 0;
        this.frameIndex = this.frameIndex === 0 ? 1 : 0;
      }

      if (t >= 1) {
        this.isMoving = false;
        this.pixelX = this.tileX * TILE_SIZE;
        this.pixelY = this.tileY * TILE_SIZE;
        this.frameIndex = 0;
        this.frameElapsedMs = 0;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, scale: number): void {
    const sprite = this.spriteSet[this.direction][this.frameIndex];
    const screenX = Math.round((this.pixelX - camera.x) * scale);
    const screenY = Math.round((this.pixelY - camera.y) * scale);
    ctx.drawImage(sprite, screenX, screenY, TILE_SIZE * scale, TILE_SIZE * scale);
  }

  /** 目前朝向前方一格的座標，用來判斷玩家面前是否站著 NPC。 */
  tileInFront(): { x: number; y: number } {
    const { dx, dy } = DIRECTION_DELTA[this.direction];
    return { x: this.tileX + dx, y: this.tileY + dy };
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
