import type { GameMap } from "./map";
import type { Direction } from "./pixelSprite";

/** 走上這一格就會被傳送到另一個區域（例如建築物大門 ↔ 1F 大廳）。 */
export interface Warp {
  x: number;
  y: number;
  toAreaId: string;
  toX: number;
  toY: number;
  direction: Direction;
}

/** 地圖上的一格加上角色面向，用來描述「玩家 / NPC 出現在哪裡、面向哪邊」。 */
export interface TileSpot {
  x: number;
  y: number;
  direction: Direction;
}

/** 地圖上的文字標籤（建築物名稱、房間名稱），座標單位是格子，可以是小數用來置中。 */
export interface PlaceLabel {
  text: string;
  x: number;
  y: number;
}

/**
 * 建築物裡的一間房間（範圍含邊界）。一般房間有門，門關著的時候從走廊看不到裡面，
 * 玩家要走到門口或走進房間才看得到裡面有誰（例如老師在不在）；
 * 開放空間（open，例如美食街、餐廳）沒有門，一直看得到。
 */
export interface RoomRegion {
  /** 房號或單位名稱；查不到名稱的房間沒有 name。 */
  name?: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  doorX: number;
  doorY: number;
  open: boolean;
  /** 房間裡站人的位置：從門口往內走兩步就能面對他。 */
  npcSpot: TileSpot;
}

export function isInsideRoom(room: RoomRegion, x: number, y: number): boolean {
  return x >= room.x0 && x <= room.x1 && y >= room.y0 && y <= room.y1;
}

/** 建築物內某一層的資訊，用來決定樓梯 / 電梯可以去哪些樓層。樓層編號沒有 0：B1 是 -1、1F 是 1。 */
export interface BuildingFloorInfo {
  buildingId: string;
  buildingName: string;
  floor: number;
  /** 這棟建築物所有樓層，由高到低排列（例如 7, 6, ..., 1, -1, ..., -4）。 */
  floors: number[];
  /** 這棟的固定位置（每層共用同一套結構，所以換樓層後位置不變）。 */
  anchors: BuildingAnchors;
  /** 1F 才有：從側門進來時站的位置，順序對到戶外這棟的第 2、3……扇門（第 1 扇正門用 anchors.entranceArrival）。 */
  sideEntrances: TileSpot[];
}

/** 一座樓梯：佔的格子，以及從別層走這座樓梯上來 / 下來時，玩家出現的位置。 */
export interface Staircase {
  tiles: Array<{ x: number; y: number }>;
  arrival: TileSpot;
}

export interface BuildingAnchors {
  /** 這棟的所有樓梯（長條型在左右兩端，環形在四個角落）；從哪一座上下樓，就從同一座出來。 */
  stairs: Staircase[];
  /** 搭電梯 / 從大門進來時，玩家出現的位置。 */
  elevatorArrival: TileSpot;
  entranceArrival: TileSpot;
  /** 1F 大廳服務台人員站的位置。 */
  infoDesk: TileSpot;
}

/**
 * 一個可以獨立顯示的地圖區域：戶外校園，或某棟建築物的某一層。
 * 玩家同一時間只會在一個區域裡，NPC 也各自屬於某個區域。
 */
export interface Area {
  id: string;
  /** 狀態列上顯示的位置名稱，例如「校園」「科技大樓 3F」。 */
  name: string;
  map: GameMap;
  warps: Warp[];
  labels: PlaceLabel[];
  /** 這一層有門的房間；戶外沒有。 */
  rooms: RoomRegion[];
  building?: BuildingFloorInfo;
}

/** 樓層顯示名稱：地上是「3F」，地下是「B4」。 */
export function floorLabel(floor: number): string {
  return floor < 0 ? `B${-floor}` : `${floor}F`;
}

export function floorAreaId(buildingId: string, floor: number): string {
  return `${buildingId}-${floorLabel(floor)}`;
}
