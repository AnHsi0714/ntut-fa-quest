import { GameMap, createGrid, fillRect, setTile } from "./map";
import { TileType } from "./tileTypes";
import {
  floorAreaId,
  floorLabel,
  type Area,
  type BuildingAnchors,
  type PlaceLabel,
  type RoomRegion,
  type Staircase,
  type TileSpot,
  type Warp,
} from "./area";
import type { Direction } from "./pixelSprite";

/**
 * 建築物內部的樓層產生器。每棟建築物依實際結構選一種平面：
 *
 * - 長條型（strip）：一條東西向走廊，南北兩側排房間，中間是電梯與大廳（科研大樓、行政大樓、六教、光華館）。
 * - 環形（ring）：房間繞外圈一圈，內圈是環狀走廊，正中間鏤空（三教）。
 *
 * 同一棟的每一層共用同一套結構，只有房間名稱不同，所以換樓層後玩家出現的位置不變。
 * 房間只標出查得到的房號或單位；查不到的房間不標名稱，地下室預設不放教室。
 */

/** 一間房間的設定。字串是只有名稱的一般房間；{} 是查不到名稱的一般房間。 */
export type RoomSpec =
  | string
  | {
      name?: string;
      /** 長條型才有：橫跨幾個房間寬度（例如美食街、餐廳這種大空間）。 */
      span?: number;
      /** 開放空間：沒有門和隔間牆，從走廊直接看得到。 */
      open?: boolean;
    };

/** 長條型的一層：南北兩側各自由西到東的房間，null 代表那一格沒有房間（是牆）。 */
export interface StripFloorPlan {
  north?: Array<RoomSpec | null>;
  south?: Array<RoomSpec | null>;
}

/** 環形的一層：房間依順時針（北側由西到東、東側由北到南、南側由東到西、西側由南到北）排入。 */
export interface RingFloorPlan {
  rooms?: Array<RoomSpec | null>;
}

export type BuildingLayout =
  | {
      type: "strip";
      /** 電梯 / 大廳西側、東側各有幾個房間寬度（每格 4 格寬，加 1 格隔間牆）。 */
      slotsWest: number;
      slotsEast: number;
      floors?: Record<number, StripFloorPlan>;
    }
  | {
      type: "ring";
      /** 北側、南側一排有幾個房間寬度（其中一格是電梯 / 大廳）。 */
      across: number;
      /** 東側、西側各有幾間房。 */
      side: number;
      floors?: Record<number, RingFloorPlan>;
    };

export interface BuildingSpec {
  id: string;
  name: string;
  /** 地上最高樓層。 */
  topFloor: number;
  /** 地下有幾層，沒有地下室就不填。 */
  basementCount?: number;
  layout: BuildingLayout;
  /**
   * 走出 1F 出口後，玩家出現的位置與面向。絕大部分建築物是回到戶外地圖、站在大門正下方、面向下；
   * 先鋒大樓的門開在北側（面向忠孝東路對面的正校門），出來後站在門口正上方、面向上。
   * 科研大樓沒有自己的大門，1F 出口通到前面相連的六教 1F，這時 name 是那棟的名稱，出口標籤會寫「往某某」。
   */
  exitTo: { areaId: string; x: number; y: number; direction: Direction; name?: string };
  /**
   * 長條型才有：1F 大廳北邊開一條通道，走到底會進到後面相連的建築物（六教 → 科研大樓）。
   * to 是進到那棟之後玩家出現的位置。
   */
  backPassage?: { name: string; to: { areaId: string; x: number; y: number; direction: Direction } };
}

const ROOM_W = 4;
const SLOT = ROOM_W + 1;

type StripLayout = Extract<BuildingLayout, { type: "strip" }>;

/**
 * 長條型 1F 後方通道的位置：在電梯井東側那一行，從走廊往北打通到最北邊的牆，出口開在牆上。
 * 從後面那棟走過來時，站在出口往南兩格、面向南（跟出口隔一格，才不會一動就被彈回去）。
 */
export function stripBackPassage(layout: StripLayout): { exit: { x: number; y: number }; arrival: TileSpot } {
  const coreX = 1 + layout.slotsWest * SLOT;
  return { exit: { x: coreX + 2, y: 0 }, arrival: { x: coreX + 2, y: 2, direction: "down" } };
}

/** 這棟建築物所有樓層，由高到低排列（例如 7, 6, ..., 1, -1, ..., -4）。 */
export function buildingFloors(spec: Pick<BuildingSpec, "topFloor" | "basementCount">): number[] {
  const floors: number[] = [];
  for (let floor = spec.topFloor; floor >= 1; floor--) floors.push(floor);
  for (let basement = 1; basement <= (spec.basementCount ?? 0); basement++) floors.push(-basement);
  return floors;
}

function normalize(spec: RoomSpec): { name?: string; span: number; open: boolean } {
  if (typeof spec === "string") return { name: spec, span: 1, open: false };
  return { name: spec.name, span: spec.span ?? 1, open: spec.open ?? false };
}

const STEP: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
const OPPOSITE: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };

/** 樓層的繪製工具：挖房間、開門、記錄房間資訊與標籤。 */
class FloorCanvas {
  readonly grid: TileType[][];
  readonly rooms: RoomRegion[] = [];
  readonly labels: PlaceLabel[] = [];

  constructor(
    readonly width: number,
    readonly height: number
  ) {
    this.grid = createGrid(width, height, TileType.InteriorWall);
  }

  fill(x0: number, y0: number, x1: number, y1: number, tile: TileType): void {
    fillRect(this.grid, x0, y0, x1 - x0 + 1, y1 - y0 + 1, tile);
  }

  set(x: number, y: number, tile: TileType): void {
    setTile(this.grid, x, y, tile);
  }

  /**
   * 挖一間房間。door 是房門所在的牆格，inward 是從門口往房間裡走的方向。
   * 開放空間會把房間與走廊之間那一整面牆打通，不放門。
   */
  room(
    spec: RoomSpec,
    rect: { x0: number; y0: number; x1: number; y1: number },
    door: { x: number; y: number },
    inward: Direction
  ): void {
    const { name, open } = normalize(spec);
    this.fill(rect.x0, rect.y0, rect.x1, rect.y1, TileType.Floor);
    if (open) {
      if (inward === "up" || inward === "down") this.fill(rect.x0, door.y, rect.x1, door.y, TileType.Floor);
      else this.fill(door.x, rect.y0, door.x, rect.y1, TileType.Floor);
    } else {
      this.set(door.x, door.y, TileType.Door);
    }

    const step = STEP[inward];
    const npcX = Math.min(rect.x1, Math.max(rect.x0, door.x + step.dx * 3));
    const npcY = Math.min(rect.y1, Math.max(rect.y0, door.y + step.dy * 3));
    this.rooms.push({
      name,
      ...rect,
      doorX: door.x,
      doorY: door.y,
      open,
      npcSpot: { x: npcX, y: npcY, direction: OPPOSITE[inward] },
    });
    if (name) this.labels.push({ text: name, x: (rect.x0 + rect.x1) / 2, y: rect.y0 });
  }
}

interface FloorBuild {
  canvas: FloorCanvas;
  anchors: BuildingAnchors;
  /** 1F 出口的位置。 */
  exit: { x: number; y: number };
  /** 1F 大廳休息區沙發的位置。 */
  benches: Array<{ x: number; y: number }>;
}

/** 在某一列 / 某一行放一座兩格寬的樓梯。 */
function placeStairs(canvas: FloorCanvas, tiles: Array<{ x: number; y: number }>, arrival: TileSpot): Staircase {
  for (const tile of tiles) canvas.set(tile.x, tile.y, TileType.Stairs);
  return { tiles, arrival };
}

/**
 * 長條型：
 *   y=0      牆
 *   y=1..5   北側房間（門開在 y=6）；電梯井在正中間
 *   y=6      牆 + 房門 + 電梯
 *   y=7..8   走廊，東西兩端各有一座樓梯
 *   y=9      牆 + 房門；1F 正中間是大廳，直接跟走廊相通
 *   y=10..13 南側房間；1F 正中間是大廳，兩側都有隔間牆（其他樓層那一塊是實心牆）
 *   y=14     牆；只有 1F 在大廳正下方有出口
 */
function buildStripFloor(layout: StripLayout, floor: number): FloorBuild {
  const coreX = 1 + layout.slotsWest * SLOT;
  const width = coreX + 4 + layout.slotsEast * SLOT;
  const canvas = new FloorCanvas(width, 15);
  const slotX = (index: number) =>
    index < layout.slotsWest ? 1 + index * SLOT : coreX + 4 + (index - layout.slotsWest) * SLOT;

  canvas.fill(2, 7, width - 2, 8, TileType.Floor);
  const stairs = [
    placeStairs(canvas, [{ x: 1, y: 7 }, { x: 1, y: 8 }], { x: 2, y: 7, direction: "right" }),
    placeStairs(
      canvas,
      [
        { x: width - 1, y: 7 },
        { x: width - 1, y: 8 },
      ],
      { x: width - 2, y: 7, direction: "left" }
    ),
  ];
  canvas.set(coreX + 1, 6, TileType.Elevator);
  // 大廳只有 1F 才有；2F 以上與地下室那一塊是實心牆
  if (floor === 1) canvas.fill(coreX, 9, coreX + 2, 13, TileType.Floor);

  const slotCount = layout.slotsWest + layout.slotsEast;
  const defaultPlan: StripFloorPlan =
    floor > 0 ? { north: Array(slotCount).fill({}), south: Array(slotCount).fill({}) } : {};
  const plan = layout.floors?.[floor] ?? defaultPlan;

  for (const side of ["north", "south"] as const) {
    const specs = plan[side] ?? [];
    for (let index = 0; index < specs.length; index++) {
      const spec = specs[index];
      if (!spec) continue;
      const { span } = normalize(spec);
      const lastIndex = index + span - 1;
      const crossesCore = index < layout.slotsWest && lastIndex >= layout.slotsWest;
      if (crossesCore || lastIndex >= slotCount) {
        throw new Error(`房間跨過電梯 / 大廳或超出範圍：樓層 ${floor} ${side} 第 ${index} 格`);
      }
      const x0 = slotX(index);
      const x1 = slotX(lastIndex) + ROOM_W - 1;
      const doorX = Math.floor((x0 + x1) / 2);
      if (side === "north") canvas.room(spec, { x0, y0: 1, x1, y1: 5 }, { x: doorX, y: 6 }, "up");
      else canvas.room(spec, { x0, y0: 10, x1, y1: 13 }, { x: doorX, y: 9 }, "down");
      index = lastIndex;
    }
  }

  return {
    canvas,
    exit: { x: coreX + 1, y: 14 },
    benches: [
      { x: coreX, y: 11 },
      { x: coreX, y: 12 },
    ],
    anchors: {
      stairs,
      elevatorArrival: { x: coreX + 1, y: 7, direction: "down" },
      // 跟 exit（y=14）隔一格，不然一進門按一下「往出口方向」的方向鍵就會立刻被彈回門外。
      entranceArrival: { x: coreX + 1, y: 12, direction: "up" },
      infoDesk: { x: coreX + 2, y: 11, direction: "left" },
    },
  };
}

/**
 * 環形（三教）：外圈一圈房間，內圈是環狀走廊，正中間在 1F 是可以走的中庭，2F 以上是鏤空挑空。
 * 北側正中間那一格是電梯井；南側正中間那一格在 1F 是大廳，其他樓層是一般房間。
 * 樓梯在環狀走廊的四個角落。
 */
function buildRingFloor(layout: Extract<BuildingLayout, { type: "ring" }>, floor: number): FloorBuild {
  const { across, side } = layout;
  const width = 1 + across * SLOT;
  // 中段：上下各一排牆，中間每間側邊房間 3 格高、房間之間隔一排牆
  const middle = side * 4 + 1;
  const height = 16 + middle;
  const canvas = new FloorCanvas(width, height);
  const coreSlot = Math.floor(across / 2);
  const coreX = 1 + coreSlot * SLOT;

  const northCorridor = 6;
  const southCorridor = 8 + middle;
  const southWall = 10 + middle;
  const southRoomTop = 11 + middle;

  // 環狀走廊與中間的鏤空
  canvas.fill(2, northCorridor, width - 3, northCorridor + 1, TileType.Floor);
  canvas.fill(2, southCorridor, width - 3, southCorridor + 1, TileType.Floor);
  canvas.fill(6, 8, 7, 7 + middle, TileType.Floor);
  canvas.fill(width - 8, 8, width - 7, 7 + middle, TileType.Floor);
  canvas.fill(8, 8, width - 9, 7 + middle, floor === 1 ? TileType.Courtyard : TileType.Atrium);
  // 四個角落的樓梯：東西兩端各兩座（北側走廊、南側走廊）
  const stairs: Staircase[] = [];
  for (const row of [northCorridor, southCorridor]) {
    const rows = [row, row + 1];
    stairs.push(
      placeStairs(
        canvas,
        rows.map((y) => ({ x: 1, y })),
        { x: 2, y: row, direction: "right" }
      ),
      placeStairs(
        canvas,
        rows.map((y) => ({ x: width - 2, y })),
        { x: width - 3, y: row, direction: "left" }
      )
    );
  }
  canvas.set(coreX + 1, 5, TileType.Elevator);
  if (floor === 1) canvas.fill(coreX, southWall, coreX + ROOM_W - 1, southRoomTop + 3, TileType.Floor);

  // 順時針排列的房間位置
  type Place = { rect: { x0: number; y0: number; x1: number; y1: number }; door: { x: number; y: number }; inward: Direction };
  const places: Place[] = [];
  for (let i = 0; i < across; i++) {
    if (i === coreSlot) continue;
    const x0 = 1 + i * SLOT;
    places.push({ rect: { x0, y0: 1, x1: x0 + 3, y1: 4 }, door: { x: x0 + 1, y: 5 }, inward: "up" });
  }
  for (let j = 0; j < side; j++) {
    const y0 = 9 + j * 4;
    places.push({
      rect: { x0: width - 5, y0, x1: width - 2, y1: y0 + 2 },
      door: { x: width - 6, y: y0 + 1 },
      inward: "right",
    });
  }
  for (let i = across - 1; i >= 0; i--) {
    // 南側正中間：1F 是大廳，其他樓層是一般房間
    if (i === coreSlot && floor === 1) continue;
    const x0 = 1 + i * SLOT;
    places.push({
      rect: { x0, y0: southRoomTop, x1: x0 + 3, y1: southRoomTop + 3 },
      door: { x: x0 + 1, y: southWall },
      inward: "down",
    });
  }
  for (let j = side - 1; j >= 0; j--) {
    const y0 = 9 + j * 4;
    places.push({ rect: { x0: 1, y0, x1: 4, y1: y0 + 2 }, door: { x: 5, y: y0 + 1 }, inward: "left" });
  }

  const defaultRooms = floor > 0 ? places.map(() => ({})) : [];
  const specs = layout.floors?.[floor]?.rooms ?? defaultRooms;
  if (specs.length > places.length) throw new Error(`環形建築 ${floor} 樓的房間數超過 ${places.length} 間`);
  specs.forEach((spec, index) => {
    if (spec) canvas.room(spec, places[index].rect, places[index].door, places[index].inward);
  });

  return {
    canvas,
    exit: { x: coreX + 1, y: height - 1 },
    benches: [
      { x: coreX, y: southRoomTop + 1 },
      { x: coreX, y: southRoomTop + 2 },
    ],
    anchors: {
      stairs,
      elevatorArrival: { x: coreX + 1, y: northCorridor, direction: "down" },
      // 跟 exit（height - 1）隔一格，不然一進門按一下「往出口方向」的方向鍵就會立刻被彈回門外。
      entranceArrival: { x: coreX + 1, y: southRoomTop + 2, direction: "up" },
      infoDesk: { x: coreX + 3, y: southRoomTop + 1, direction: "left" },
    },
  };
}

/** 依照這棟的結構，產生某一層的 Area。 */
export function buildFloorArea(spec: BuildingSpec, floor: number): Area {
  const built =
    spec.layout.type === "strip" ? buildStripFloor(spec.layout, floor) : buildRingFloor(spec.layout, floor);
  const { canvas, anchors } = built;

  const warps: Warp[] = [];
  if (floor === 1) {
    for (const bench of built.benches) canvas.set(bench.x, bench.y, TileType.Bench);
    canvas.labels.push({ text: "休息區", x: built.benches[0].x, y: built.benches[0].y });
    canvas.set(built.exit.x, built.exit.y, TileType.Exit);
    warps.push({
      x: built.exit.x,
      y: built.exit.y,
      toAreaId: spec.exitTo.areaId,
      toX: spec.exitTo.x,
      toY: spec.exitTo.y,
      direction: spec.exitTo.direction,
    });
    const exitText = spec.exitTo.name ? `往${spec.exitTo.name}` : "出口";
    canvas.labels.push({ text: exitText, x: built.exit.x, y: built.exit.y - 1 });

    if (spec.backPassage) {
      if (spec.layout.type !== "strip") throw new Error(`${spec.name}：只有長條型建築可以開後方通道`);
      const { exit } = stripBackPassage(spec.layout);
      canvas.fill(exit.x, exit.y + 1, exit.x, 6, TileType.Floor);
      canvas.set(exit.x, exit.y, TileType.Exit);
      const { to } = spec.backPassage;
      warps.push({ x: exit.x, y: exit.y, toAreaId: to.areaId, toX: to.x, toY: to.y, direction: to.direction });
      canvas.labels.push({ text: `往${spec.backPassage.name}`, x: exit.x, y: exit.y + 2 });
    }
  }

  return {
    id: floorAreaId(spec.id, floor),
    name: `${spec.name} ${floorLabel(floor)}`,
    map: new GameMap(canvas.width, canvas.height, canvas.grid, TileType.InteriorWall),
    warps,
    labels: canvas.labels,
    rooms: canvas.rooms,
    building: {
      buildingId: spec.id,
      buildingName: spec.name,
      floor,
      floors: buildingFloors(spec),
      anchors,
    },
  };
}

/** 依房間名稱找到某一層的房間（NPC 放在哪間房用）。 */
export function findRoom(area: Area, name: string): RoomRegion {
  const room = area.rooms.find((candidate) => candidate.name === name);
  if (!room) throw new Error(`${area.id} 找不到房間「${name}」`);
  return room;
}

export type { TileSpot };
