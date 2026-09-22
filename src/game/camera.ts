import { TILE_SIZE } from "./tileArt";

/** 追蹤玩家的攝影機，座標單位是「地圖像素」（尚未乘上畫面縮放倍率）。 */
export class Camera {
  x = 0;
  y = 0;

  follow(
    targetPixelX: number,
    targetPixelY: number,
    viewportWidth: number,
    viewportHeight: number,
    mapWidthTiles: number,
    mapHeightTiles: number
  ): void {
    const mapPixelWidth = mapWidthTiles * TILE_SIZE;
    const mapPixelHeight = mapHeightTiles * TILE_SIZE;

    let x = targetPixelX + TILE_SIZE / 2 - viewportWidth / 2;
    let y = targetPixelY + TILE_SIZE / 2 - viewportHeight / 2;

    const maxX = Math.max(0, mapPixelWidth - viewportWidth);
    const maxY = Math.max(0, mapPixelHeight - viewportHeight);
    x = clamp(x, 0, maxX);
    y = clamp(y, 0, maxY);

    this.x = x;
    this.y = y;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
