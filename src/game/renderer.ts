import type { GameMap } from "./map";
import { getTileSet, TILE_SIZE } from "./tileArt";
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

  draw(map: GameMap, camera: Camera, player: Player, npcs: Npc[]): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawTiles(map, camera);

    const entities: Array<Player | Npc> = [...npcs, player];
    entities.sort((a, b) => a.tileY - b.tileY);
    for (const entity of entities) {
      entity.draw(ctx, camera, 1);
    }
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
