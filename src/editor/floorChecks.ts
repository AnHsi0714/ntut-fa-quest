import { isInsideRoom, type RoomRegion, type Staircase } from "../game/area";
import { TileType, isTileWalkable } from "../game/tileTypes";
import type { FloorOverride } from "../game/floorOverride";
import type { Direction } from "../game/pixelSprite";

/** 編輯器用的純函式：整理樓梯格子、建立房間、檢查手畫樓層能不能放進遊戲。 */

const NEIGHBORS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function tileAt(grid: TileType[][], x: number, y: number): TileType | undefined {
  return grid[y]?.[x];
}

function walkable(grid: TileType[][], x: number, y: number): boolean {
  const tile = tileAt(grid, x, y);
  return tile !== undefined && isTileWalkable(tile);
}

/** 每座樓梯的格子：從抵達點旁邊的樓梯格開始，把連在一起的樓梯格都算進這一座。 */
export function stairTilesNear(grid: TileType[][], arrival: { x: number; y: number }): Array<{ x: number; y: number }> {
  const seen = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [];
  for (const [dx, dy] of NEIGHBORS) {
    const x = arrival.x + dx;
    const y = arrival.y + dy;
    if (tileAt(grid, x, y) === TileType.Stairs) {
      seen.add(`${x},${y}`);
      queue.push({ x, y });
    }
  }
  const tiles: Array<{ x: number; y: number }> = [];
  while (queue.length > 0) {
    const tile = queue.shift()!;
    tiles.push(tile);
    for (const [dx, dy] of NEIGHBORS) {
      const x = tile.x + dx;
      const y = tile.y + dy;
      if (!seen.has(`${x},${y}`) && tileAt(grid, x, y) === TileType.Stairs) {
        seen.add(`${x},${y}`);
        queue.push({ x, y });
      }
    }
  }
  return tiles.sort((a, b) => a.y - b.y || a.x - b.x);
}

export function refreshStairTiles(grid: TileType[][], stairs: Staircase[]): Staircase[] {
  return stairs.map((staircase) => ({ ...staircase, tiles: stairTilesNear(grid, staircase.arrival) }));
}

const STEP: Record<Direction, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };

/**
 * 依範圍與門口建立房間（跟 buildingLayout 的規則一樣）：門要貼在房間某一邊的外側，
 * NPC 站在從門口往內走三步的位置（碰到牆就停在最裡面）、面向門口。門不合法時回傳 undefined。
 */
export function makeRoom(
  rect: { x0: number; y0: number; x1: number; y1: number },
  door: { x: number; y: number },
  name: string | undefined,
  open: boolean
): RoomRegion | undefined {
  const withinX = door.x >= rect.x0 && door.x <= rect.x1;
  const withinY = door.y >= rect.y0 && door.y <= rect.y1;
  let inward: Direction | undefined;
  if (withinX && door.y === rect.y0 - 1) inward = "down";
  else if (withinX && door.y === rect.y1 + 1) inward = "up";
  else if (withinY && door.x === rect.x0 - 1) inward = "right";
  else if (withinY && door.x === rect.x1 + 1) inward = "left";
  if (!inward) return undefined;
  const [dx, dy] = STEP[inward];
  return {
    ...(name ? { name } : {}),
    ...rect,
    doorX: door.x,
    doorY: door.y,
    open,
    npcSpot: {
      x: Math.min(rect.x1, Math.max(rect.x0, door.x + dx * 3)),
      y: Math.min(rect.y1, Math.max(rect.y0, door.y + dy * 3)),
      direction: OPPOSITE[inward],
    },
  };
}

export interface FloorCheck {
  ok: boolean;
  message: string;
}

export interface CheckContext {
  /** 同一棟其他樓層的樓梯數量（換樓層是用第幾座樓梯對到另一層）。 */
  expectedStairs: number;
  isGroundFloor: boolean;
  needsBackPassage: boolean;
  /** 原本這層有名稱的房間；NPC 用房間名稱找位置，少了會找不到人。 */
  originalRoomNames: string[];
}

function reachableFrom(grid: TileType[][], start: { x: number; y: number }): Set<string> {
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (!seen.has(key) && walkable(grid, nx, ny)) {
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return seen;
}

/** 跟 campusMapData.test.ts 的規則一致，讓手畫樓層在匯出前就知道哪裡會讓測試失敗。 */
export function checkFloor(override: FloorOverride, grid: TileType[][], context: CheckContext): FloorCheck[] {
  const checks: FloorCheck[] = [];
  const add = (ok: boolean, message: string) => checks.push({ ok, message });
  const { anchors } = override;
  const at = (spot: { x: number; y: number }) => `(${spot.x}, ${spot.y})`;

  add(
    anchors.stairs.length === context.expectedStairs,
    `樓梯 ${anchors.stairs.length} 座（這棟其他樓層是 ${context.expectedStairs} 座，數量跟順序要一樣）`
  );
  anchors.stairs.forEach((staircase, index) => {
    const label = `第 ${index + 1} 座樓梯抵達點 ${at(staircase.arrival)}`;
    add(walkable(grid, staircase.arrival.x, staircase.arrival.y), `${label}：站得上去`);
    add(stairTilesNear(grid, staircase.arrival).length > 0, `${label}：旁邊有樓梯格`);
  });
  const elevator = anchors.elevatorArrival;
  add(walkable(grid, elevator.x, elevator.y), `電梯抵達點 ${at(elevator)}：站得上去`);
  add(tileAt(grid, elevator.x, elevator.y - 1) === TileType.Elevator, `電梯抵達點 ${at(elevator)}：正上方一格是電梯`);

  if (context.isGroundFloor) {
    const entrance = anchors.entranceArrival;
    add(walkable(grid, entrance.x, entrance.y), `入口抵達點 ${at(entrance)}：站得上去`);
    add(walkable(grid, anchors.infoDesk.x, anchors.infoDesk.y), `服務台 ${at(anchors.infoDesk)}：站得上去`);
    const exit = override.exit;
    add(!!exit && tileAt(grid, exit.x, exit.y) === TileType.Exit, `出口${exit ? ` ${at(exit)}` : ""}：有標、而且是出口圖塊`);
    if (exit) {
      const distance = Math.abs(exit.x - entrance.x) + Math.abs(exit.y - entrance.y);
      add(distance > 1, "出口跟入口抵達點至少隔一格（不然一進門就被彈出去）");
    }
    add(
      grid.some((row) => row.includes(TileType.Bench)),
      "大廳有休息區沙發"
    );
  }
  if (context.needsBackPassage) {
    const passage = override.backPassage;
    add(
      !!passage && tileAt(grid, passage.exit.x, passage.exit.y) === TileType.Exit,
      "後方通道出口：有標、而且是出口圖塊"
    );
    if (passage) {
      add(walkable(grid, passage.arrival.x, passage.arrival.y), `後方通道抵達點 ${at(passage.arrival)}：站得上去`);
      const distance = Math.abs(passage.exit.x - passage.arrival.x) + Math.abs(passage.exit.y - passage.arrival.y);
      add(distance > 1, "後方通道抵達點跟通道出口至少隔一格");
    }
  }

  if (anchors.stairs.length > 0) {
    const reachable = reachableFrom(grid, anchors.stairs[0].arrival);
    const spots: Array<[string, { x: number; y: number }]> = [
      ["電梯抵達點", elevator],
      ...anchors.stairs.map((s, i): [string, { x: number; y: number }] => [`第 ${i + 1} 座樓梯抵達點`, s.arrival]),
    ];
    if (context.isGroundFloor) spots.push(["入口抵達點", anchors.entranceArrival]);
    if (context.isGroundFloor && override.exit) spots.push(["出口", override.exit]);
    for (const room of override.rooms) spots.push([`房間「${room.name ?? "未命名"}」門口`, { x: room.doorX, y: room.doorY }]);
    const unreachable = spots.filter(([, spot]) => !reachable.has(`${spot.x},${spot.y}`)).map(([name]) => name);
    add(unreachable.length === 0, unreachable.length === 0 ? "從第 1 座樓梯走得到所有標記與房門" : `走不到：${unreachable.join("、")}`);
  }

  for (const room of override.rooms) {
    const label = `房間「${room.name ?? "未命名"}」`;
    if (!room.open) add(tileAt(grid, room.doorX, room.doorY) === TileType.Door, `${label}：門口是門`);
    const leaks: string[] = [];
    for (let x = room.x0 - 1; x <= room.x1 + 1; x++) {
      for (let y = room.y0 - 1; y <= room.y1 + 1; y++) {
        if (isInsideRoom(room, x, y)) continue;
        const doorSide = room.open ? y === room.doorY && x >= room.x0 && x <= room.x1 : x === room.doorX && y === room.doorY;
        if (!doorSide && walkable(grid, x, y)) leaks.push(`(${x}, ${y})`);
      }
    }
    add(leaks.length === 0, leaks.length === 0 ? `${label}：四周都是牆` : `${label}：外圍這些格子不是牆 ${leaks.join(" ")}`);
  }

  const names = new Set(override.rooms.map((room) => room.name));
  const missing = context.originalRoomNames.filter((name) => !names.has(name));
  add(
    missing.length === 0,
    missing.length === 0 ? "原本有名稱的房間都還在" : `少了這些房間（NPC 可能用房間名稱找位置）：${missing.join("、")}`
  );
  return checks;
}
