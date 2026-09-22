import { GameMap, createGrid, fillRect, setTile } from "./map";
import { TileType } from "./tileTypes";
import type { Direction } from "./pixelSprite";

export const MAP_WIDTH = 22;
export const MAP_HEIGHT = 17;

export interface NpcSpawn {
  id: string;
  name: string;
  /** 對應 NPC_PALETTES 的角色外觀 key，見計畫書第 7 節 NPC 設計。 */
  paletteKey: string;
  /** 對應計畫書 9.1 節：固定時段型 / 遊走型，目前框架版本先固定站在原地，時間 / 機率邏輯留待後續 Phase 實作。 */
  kind: "fixed" | "wandering";
  locationLabel: string;
  x: number;
  y: number;
  direction: Direction;
  greeting: string;
}

/**
 * 簡化版校園地圖，對應計畫書第 6 節：教務處、系辦、系主任室、教師研究室、校園廣場與連通道路。
 * 第一版不追求完整重現校園，只建立專題示範所需的地點。
 */
export function buildCampusMap(): { map: GameMap; npcSpawns: NpcSpawn[] } {
  const grid = createGrid(MAP_WIDTH, MAP_HEIGHT, TileType.Grass);

  // 外圍邊界（樹林），把玩家限制在地圖範圍內
  fillRect(grid, 0, 0, MAP_WIDTH, 1, TileType.Border);
  fillRect(grid, 0, MAP_HEIGHT - 1, MAP_WIDTH, 1, TileType.Border);
  fillRect(grid, 0, 0, 1, MAP_HEIGHT, TileType.Border);
  fillRect(grid, MAP_WIDTH - 1, 0, 1, MAP_HEIGHT, TileType.Border);

  // 教師研究室（承辦老師）：左上角
  fillRect(grid, 1, 2, 4, 3, TileType.Wall);
  setTile(grid, 2, 4, TileType.Door);

  // 教務處：上方中央
  fillRect(grid, 9, 2, 6, 4, TileType.Wall);
  setTile(grid, 11, 5, TileType.Door);

  // 系辦：左側
  fillRect(grid, 3, 8, 5, 4, TileType.Wall);
  setTile(grid, 5, 11, TileType.Door);

  // 系主任室：右側
  fillRect(grid, 15, 8, 5, 3, TileType.Wall);
  setTile(grid, 17, 10, TileType.Door);

  // 校園廣場
  fillRect(grid, 6, 12, 11, 3, TileType.Plaza);

  // 道路：連接各建築物到廣場前的主要通道
  fillRect(grid, 2, 5, 1, 6, TileType.Path); // 教師研究室 → 主幹道
  fillRect(grid, 11, 6, 1, 5, TileType.Path); // 教務處 → 主幹道
  fillRect(grid, 2, 11, 16, 1, TileType.Path); // 主幹道（連接系辦門口、教師研究室、教務處、系主任室）

  const map = new GameMap(MAP_WIDTH, MAP_HEIGHT, grid);

  const npcSpawns: NpcSpawn[] = [
    {
      id: "advisor",
      name: "承辦老師",
      paletteKey: "advisor",
      kind: "fixed",
      locationLabel: "教師研究室",
      x: 2,
      y: 5,
      direction: "down",
      greeting: "你好，我是承辦老師。申請文件 A 請先在這裡簽核，再去系辦，最後到教務處送件。",
    },
    {
      id: "academicAffairs",
      name: "教務處人員",
      paletteKey: "academicAffairs",
      kind: "fixed",
      locationLabel: "教務處",
      x: 11,
      y: 6,
      direction: "down",
      greeting: "歡迎來到教務處，這裡是文件 A 的最後一站。",
    },
    {
      id: "department",
      name: "系辦人員",
      paletteKey: "department",
      kind: "fixed",
      locationLabel: "系辦",
      x: 5,
      y: 12,
      direction: "down",
      greeting: "系辦已經收件，請再前往教務處完成最後送件。",
    },
    {
      id: "departmentHead",
      name: "系主任",
      paletteKey: "departmentHead",
      kind: "wandering",
      locationLabel: "系主任室",
      x: 17,
      y: 11,
      direction: "down",
      greeting: "（框架版本）我是系主任，出現機率邏輯尚未串接。",
    },
  ];

  return { map, npcSpawns };
}
