/** 地圖上的圖塊種類，對應計畫書第 6 節的校園地圖元素。 */
export enum TileType {
  Grass = "grass",
  Path = "path",
  Plaza = "plaza",
  Wall = "wall",
  Door = "door",
  Border = "border",
}

/** 玩家 / NPC 是否可以走上這個圖塊。 */
export function isTileWalkable(tile: TileType): boolean {
  switch (tile) {
    case TileType.Grass:
    case TileType.Path:
    case TileType.Plaza:
    case TileType.Door:
      return true;
    case TileType.Wall:
    case TileType.Border:
      return false;
  }
}
