import { TileType, isTileWalkable } from "./tileTypes";

export class GameMap {
  readonly width: number;
  readonly height: number;
  private readonly tiles: TileType[][];
  /** 地圖範圍外要畫什麼：戶外是樹林，建築物裡是牆（比畫面窄的樓層置中後兩側會露出來）。 */
  private readonly outsideTile: TileType;

  constructor(width: number, height: number, tiles: TileType[][], outsideTile = TileType.Border) {
    this.width = width;
    this.height = height;
    this.tiles = tiles;
    this.outsideTile = outsideTile;
  }

  getTile(x: number, y: number): TileType {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return this.outsideTile;
    }
    return this.tiles[y][x];
  }

  isWalkable(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return false;
    }
    return isTileWalkable(this.tiles[y][x]);
  }
}

export function createGrid(width: number, height: number, fill: TileType): TileType[][] {
  return Array.from({ length: height }, () => Array<TileType>(width).fill(fill));
}

export function fillRect(
  grid: TileType[][],
  x: number,
  y: number,
  w: number,
  h: number,
  tile: TileType
): void {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      if (grid[row] && grid[row][col] !== undefined) {
        grid[row][col] = tile;
      }
    }
  }
}

export function setTile(grid: TileType[][], x: number, y: number, tile: TileType): void {
  if (grid[y] && grid[y][x] !== undefined) {
    grid[y][x] = tile;
  }
}
