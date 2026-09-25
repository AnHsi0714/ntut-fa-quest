import type { GameMap } from "./map";
import {
  getEmptySeatSprite,
  getOpenDoorSprite,
  getRoomCoverSprite,
  getTileSet,
  TILE_SIZE,
} from "./tileArt";
import type { RoomRegion } from "./area";
import type { Camera } from "./camera";
import type { Player } from "./player";
import type { Npc } from "./npc";

/**
 * 畫面渲染在「原生像素解析度」下進行（canvas 內部解析度很小），
 * 再交給 CSS 用 image-rendering: pixelated 放大顯示，做出復古像素 RPG 的清晰格線感。
 */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context 不可用");
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
  }

  get viewportWidth(): number {
    return this.canvas.width;
  }

  get viewportHeight(): number {
    return this.canvas.height;
  }

  draw(
    map: GameMap,
    camera: Camera,
    player: Player,
    npcs: Npc[],
    rooms: { visible: RoomRegion[]; hidden: RoomRegion[] } = { visible: [], hidden: [] }
  ): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawTiles(map, camera);
    // 玩家所在（或站在門口）的房間，門畫成打開的樣子
    const openDoor = getOpenDoorSprite();
    for (const room of rooms.visible) {
      this.drawSprite(openDoor, room.doorX, room.doorY, camera);
    }

    // 呼叫端只會傳入跟玩家在同一個區域的 NPC。不在場的 NPC 不畫人，只在他的位置畫一張空椅子，
    // 玩家看得出「這裡平常有人、現在不在」，走過去互動一樣會記錄成撲空。
    const seat = getEmptySeatSprite();
    for (const npc of npcs) {
      if (npc.isPresent) continue;
      ctx.drawImage(seat, Math.round(npc.pixelX - camera.x), Math.round(npc.pixelY - camera.y));
    }

    const entities: Array<Player | Npc> = [...npcs.filter((npc) => npc.isPresent), player];
    entities.sort((a, b) => a.tileY - b.tileY);
    for (const entity of entities) {
      entity.draw(ctx, camera, 1);
    }

    // 門關著的房間最後整個蓋上天花板，連裡面的人和空椅子都看不到
    const cover = getRoomCoverSprite();
    for (const room of rooms.hidden) {
      for (let y = room.y0; y <= room.y1; y++) {
        for (let x = room.x0; x <= room.x1; x++) this.drawSprite(cover, x, y, camera);
      }
    }
  }

  private drawSprite(sprite: HTMLCanvasElement, tileX: number, tileY: number, camera: Camera): void {
    this.ctx.drawImage(
      sprite,
      Math.round(tileX * TILE_SIZE - camera.x),
      Math.round(tileY * TILE_SIZE - camera.y)
    );
  }

  private drawTiles(map: GameMap, camera: Camera): void {
    const tileSet = getTileSet();
    const startCol = Math.floor(camera.x / TILE_SIZE);
    const startRow = Math.floor(camera.y / TILE_SIZE);
    const endCol = Math.ceil((camera.x + this.canvas.width) / TILE_SIZE);
    const endRow = Math.ceil((camera.y + this.canvas.height) / TILE_SIZE);

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const tile = map.getTile(col, row);
        const sprite = tileSet.get(tile);
        if (!sprite) continue;
        const screenX = Math.round(col * TILE_SIZE - camera.x);
        const screenY = Math.round(row * TILE_SIZE - camera.y);
        this.ctx.drawImage(sprite, screenX, screenY);
      }
    }
  }
}
