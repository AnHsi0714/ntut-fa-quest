import { TileType } from "./tileTypes";
import type { Area, BuildingAnchors, PlaceLabel, RoomRegion, TileSpot } from "./area";

/**
 * 手畫的樓層：用開發用的樓層編輯器（editor.html）畫好、匯出成 JSON，放進 src/game/floorOverrides/，
 * 檔名就是樓層 id（例如 teaching3-1F.json）。有檔案的那一層用手畫版，其他樓層照舊由 buildingLayout 自動產生。
 *
 * 同一棟的樓梯要維持一樣的數量與順序：換樓層時是用「第幾座樓梯」找到另一層同一座樓梯的抵達點。
 */
export interface FloorOverride {
  version: 1;
  areaId: string;
  width: number;
  height: number;
  /** 每一列一個字串，每個字元照 TILE_CHARS 對到一種圖塊。 */
  tiles: string[];
  rooms: RoomRegion[];
  /** 這一層顯示的所有文字標籤（房間名稱、休息區、出口等），照原樣顯示。 */
  labels: PlaceLabel[];
  anchors: BuildingAnchors;
  /** 1F 才有：出口的位置（那一格要是出口圖塊）。 */
  exit?: { x: number; y: number };
  /** 有後方通道的樓層才有（六教 1F）：通道出口的位置，以及從後面那棟走過來時玩家出現的位置。 */
  backPassage?: { exit: { x: number; y: number }; arrival: TileSpot };
  /**
   * 1F 才有：側門。每個側門有自己的出口（那一格要是出口圖塊）與從那扇門進來時站的位置，
   * 順序對到戶外這棟的第 2、3……扇門，數量要跟戶外的側門一樣。
   */
  sideExits?: Array<{ exit: { x: number; y: number }; arrival: TileSpot }>;
}

/** 圖塊 ↔ JSON 裡的字元。新增圖塊時要在這裡補一個沒用過的字元。 */
export const TILE_CHARS: Record<TileType, string> = {
  [TileType.Grass]: ",",
  [TileType.Path]: "-",
  [TileType.Plaza]: "+",
  [TileType.Wall]: "W",
  [TileType.WallRedBrick]: "R",
  [TileType.WallYellowTile]: "Y",
  [TileType.WallTanMosaic]: "T",
  [TileType.WallWashedStone]: "O",
  [TileType.WallGlass]: "G",
  [TileType.WallConcrete]: "C",
  [TileType.Door]: "D",
  [TileType.Border]: "^",
  [TileType.Road]: "=",
  [TileType.Crosswalk]: "z",
  [TileType.CrosswalkVertical]: "|",
  [TileType.Court]: "c",
  [TileType.Track]: "t",
  [TileType.Gate]: "g",
  [TileType.Floor]: ".",
  [TileType.InteriorWall]: "#",
  [TileType.Stairs]: "S",
  [TileType.Elevator]: "L",
  [TileType.Exit]: "E",
  [TileType.Bench]: "b",
  [TileType.Atrium]: "a",
  [TileType.Courtyard]: "o",
};

const CHAR_TILES = new Map<string, TileType>(
  (Object.entries(TILE_CHARS) as Array<[TileType, string]>).map(([tile, char]) => [char, tile])
);

export function tilesToRows(grid: TileType[][]): string[] {
  return grid.map((row) => row.map((tile) => TILE_CHARS[tile]).join(""));
}

export function rowsToTiles(override: Pick<FloorOverride, "areaId" | "width" | "height" | "tiles">): TileType[][] {
  const { areaId, width, height, tiles } = override;
  if (tiles.length !== height) throw new Error(`${areaId}：tiles 有 ${tiles.length} 列，height 是 ${height}`);
  return tiles.map((row, y) => {
    if (row.length !== width) throw new Error(`${areaId}：第 ${y} 列有 ${row.length} 格，width 是 ${width}`);
    return [...row].map((char, x) => {
      const tile = CHAR_TILES.get(char);
      if (!tile) throw new Error(`${areaId}：(${x}, ${y}) 的字元「${char}」不是任何圖塊`);
      return tile;
    });
  });
}

/** src/game/floorOverrides/ 底下所有手畫樓層，key 是樓層 id。 */
export function loadFloorOverrides(): Map<string, FloorOverride> {
  const modules = import.meta.glob<FloorOverride>("./floorOverrides/*.json", { eager: true, import: "default" });
  const overrides = new Map<string, FloorOverride>();
  for (const [path, override] of Object.entries(modules)) {
    const fileId = path.replace(/^.*\//, "").replace(/\.json$/, "");
    if (override.areaId !== fileId) throw new Error(`${path}：檔名跟 areaId「${override.areaId}」不一樣`);
    overrides.set(override.areaId, override);
  }
  return overrides;
}

/**
 * 把遊戲裡現有的某一層轉成手畫格式（編輯器載入現況用）。
 * areas 是整個世界，用來找「從別棟走過來會站在這層哪裡」（六教 1F 後方通道的抵達點）。
 */
export function areaToOverride(area: Area, areas: Map<string, Area>): FloorOverride {
  if (!area.building) throw new Error(`${area.id} 不是建築物樓層`);
  const grid: TileType[][] = [];
  for (let y = 0; y < area.map.height; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < area.map.width; x++) row.push(area.map.getTile(x, y));
    grid.push(row);
  }
  const override: FloorOverride = {
    version: 1,
    areaId: area.id,
    width: area.map.width,
    height: area.map.height,
    tiles: tilesToRows(grid),
    rooms: structuredClone(area.rooms),
    labels: structuredClone(area.labels),
    anchors: structuredClone(area.building.anchors),
  };
  // 1F 的傳送點依序是：正門出口、後方通道（六教才有）、各個側門出口
  const { sideEntrances } = area.building;
  const sideWarps = area.warps.slice(area.warps.length - sideEntrances.length);
  const [exit, passage] = area.warps.slice(0, area.warps.length - sideEntrances.length);
  if (exit) override.exit = { x: exit.x, y: exit.y };
  if (sideWarps.length > 0) {
    override.sideExits = sideWarps.map((warp, index) => ({
      exit: { x: warp.x, y: warp.y },
      arrival: structuredClone(sideEntrances[index]),
    }));
  }
  if (passage) {
    const comingBack = [...areas.values()]
      .filter((other) => other.building && other.id !== area.id)
      .flatMap((other) => other.warps)
      .find((warp) => warp.toAreaId === area.id);
    if (!comingBack) throw new Error(`${area.id}：找不到從後面那棟走回來的出口`);
    override.backPassage = {
      exit: { x: passage.x, y: passage.y },
      arrival: { x: comingBack.toX, y: comingBack.toY, direction: comingBack.direction },
    };
  }
  return override;
}
