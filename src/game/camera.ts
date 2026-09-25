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

    // 地圖比畫面小（例如只有兩間房的光華館）時置中顯示，否則跟著玩家、但不超出地圖邊界。
    x =
      mapPixelWidth < viewportWidth
        ? (mapPixelWidth - viewportWidth) / 2
        : clamp(x, 0, mapPixelWidth - viewportWidth);
    y =
      mapPixelHeight < viewportHeight
        ? (mapPixelHeight - viewportHeight) / 2
        : clamp(y, 0, mapPixelHeight - viewportHeight);

    this.x = x;
    this.y = y;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
