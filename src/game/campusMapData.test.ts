import { describe, expect, it } from "vitest";
import { MAIN_GATE_SPAWN, OUTDOOR_AREA_ID, buildCampusWorld } from "./campusMapData";
import { isInsideRoom, type Area } from "./area";
import questData from "../quest/questData.json";
import { TileType } from "./tileTypes";
import type { GameMap } from "./map";
import { findPath } from "./pathfinding";
import { isNpcWalkableTile } from "./npcWalkable";

/** 從起點出發，走得到的所有格子（上下左右、只走可走的圖塊）。 */
function reachableFrom(map: GameMap, startX: number, startY: number): Set<string> {
  const seen = new Set<string>([`${startX},${startY}`]);
  const queue: Array<[number, number]> = [[startX, startY]];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (!seen.has(key) && map.isWalkable(nx, ny)) {
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return seen;
}

const isAdjacent = (reachable: Set<string>, x: number, y: number) =>
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => reachable.has(`${x + dx},${y + dy}`));

const anchorsOf = (area: Area) => area.building!.anchors;

describe("buildCampusWorld（計畫書第 6 節校園地圖）", () => {
  const { areas, npcSpawns } = buildCampusWorld();
  const outdoor = areas.get(OUTDOOR_AREA_ID)!;

  it("正門出生點在戶外地圖上、而且可以走", () => {
    expect(MAIN_GATE_SPAWN.areaId).toBe(OUTDOOR_AREA_ID);
    expect(outdoor.map.isWalkable(MAIN_GATE_SPAWN.x, MAIN_GATE_SPAWN.y)).toBe(true);
  });

  it("從正門走得到每一棟可進入建築物的大門", () => {
    const reachable = reachableFrom(outdoor.map, MAIN_GATE_SPAWN.x, MAIN_GATE_SPAWN.y);
    expect(outdoor.warps.length).toBeGreaterThan(0);
    for (const warp of outdoor.warps) {
      expect(reachable.has(`${warp.x},${warp.y}`), `大門 ${warp.toAreaId}`).toBe(true);
    }
  });

  it("所有傳送點的目的地都存在、而且落在可走的格子上", () => {
    for (const area of areas.values()) {
      for (const warp of area.warps) {
        const target = areas.get(warp.toAreaId);
        expect(target, `${area.id} → ${warp.toAreaId}`).toBeDefined();
        expect(target!.map.isWalkable(warp.toX, warp.toY)).toBe(true);
      }
    }
  });

  it("每一層的大廳、樓梯口、電梯口、房門互相走得到，樓梯與電梯就在旁邊", () => {
    for (const area of areas.values()) {
      if (!area.building) continue;
      const { stairs, elevatorArrival, entranceArrival } = anchorsOf(area);
      const start = stairs[0].arrival;
      const reachable = reachableFrom(area.map, start.x, start.y);
      expect(reachable.has(`${elevatorArrival.x},${elevatorArrival.y}`), area.id).toBe(true);
      if (area.building.floor === 1) {
        expect(reachable.has(`${entranceArrival.x},${entranceArrival.y}`), area.id).toBe(true);
      }
      for (const staircase of stairs) {
        expect(reachable.has(`${staircase.arrival.x},${staircase.arrival.y}`), area.id).toBe(true);
        const touching = staircase.tiles.some(
          (t) => Math.abs(t.x - staircase.arrival.x) + Math.abs(t.y - staircase.arrival.y) === 1
        );
        expect(touching, area.id).toBe(true);
        for (const t of staircase.tiles) expect(area.map.getTile(t.x, t.y)).toBe(TileType.Stairs);
      }
      expect(area.map.getTile(elevatorArrival.x, elevatorArrival.y - 1)).toBe(TileType.Elevator);
    }
  });

  it("只有 1F 有出口，而且出口會回到戶外地圖", () => {
    for (const area of areas.values()) {
      if (!area.building) continue;
      if (area.building.floor === 1) {
        expect(area.warps).toHaveLength(1);
        expect(area.warps[0].toAreaId).toBe(OUTDOOR_AREA_ID);
      } else {
        expect(area.warps).toHaveLength(0);
      }
    }
  });

  it("每個 NPC 都站在所屬區域的可走格子上，玩家走得到它旁邊", () => {
    for (const spawn of npcSpawns) {
      const area = areas.get(spawn.areaId);
      expect(area, spawn.id).toBeDefined();
      expect(area!.map.isWalkable(spawn.x, spawn.y), spawn.id).toBe(true);

      const start = area!.building ? anchorsOf(area!).stairs[0].arrival : MAIN_GATE_SPAWN;
      const reachable = reachableFrom(area!.map, start.x, start.y);
      reachable.delete(`${spawn.x},${spawn.y}`);
      expect(isAdjacent(reachable, spawn.x, spawn.y), spawn.id).toBe(true);
    }
  });

  it("任務用到的單位放在查得到的實際位置：教務處在行政大樓 2F、資工系辦在科研大樓 3F", () => {
    const byId = new Map(npcSpawns.map((spawn) => [spawn.id, spawn]));
    expect(byId.get("academicAffairs")!.areaId).toBe("admin-2F");
    expect(byId.get("department")!.areaId).toBe("research-3F");
  });

  it("樓層數照學校設定：科研大樓地上 16 層加地下 3 層、六教地上 7 層加地下 4 層、行政大樓 8 層", () => {
    const researchFloors = areas.get("research-16F")?.building?.floors ?? [];
    expect(researchFloors.filter((floor) => floor > 0)).toHaveLength(16);
    expect(researchFloors.filter((floor) => floor < 0)).toEqual([-1, -2, -3]);
    expect(areas.has("research-17F")).toBe(false);
    expect(areas.get("sixth-B4")?.building?.floors).toEqual([7, 6, 5, 4, 3, 2, 1, -1, -2, -3, -4]);
    expect(areas.has("admin-8F")).toBe(true);
    expect(areas.has("admin-9F")).toBe(false);
  });

  it("每棟可進入的建築物 1F 大廳都有服務台", () => {
    const enterable = [...areas.values()].filter((area) => area.building?.floor === 1);
    for (const lobby of enterable) {
      const desk = npcSpawns.find((spawn) => spawn.id === `${lobby.building!.buildingId}-desk`);
      expect(desk?.areaId, lobby.id).toBe(lobby.id);
    }
  });

  it("會走動的 NPC：每個目的地都能走，而且從出生點找得到路走過去", () => {
    const walkers = npcSpawns.filter((spawn) => spawn.destinations);
    expect(walkers.length).toBeGreaterThan(0);
    for (const spawn of walkers) {
      const area = areas.get(spawn.areaId)!;
      const canWalk = (x: number, y: number) => isNpcWalkableTile(area, x, y);
      expect(canWalk(spawn.x, spawn.y), `${spawn.id} 出生點`).toBe(true);
      expect(spawn.destinations!.length, spawn.id).toBeGreaterThan(1);
      for (const destination of spawn.destinations!) {
        const label = `${spawn.id} → (${destination.x}, ${destination.y})`;
        expect(canWalk(destination.x, destination.y), label).toBe(true);
        expect(findPath(spawn, destination, canWalk), label).not.toBeNull();
      }
    }
  });

  it("科研大樓 B3 是影印中心，影印店老闆在那裡", () => {
    const printShop = npcSpawns.find((spawn) => spawn.service === "print");
    expect(printShop?.areaId).toBe("research-B3");
    expect(areas.get("research-B3")?.labels.some((label) => label.text === "影印中心")).toBe(true);
  });

  it("每棟 1F 大廳都有休息區沙發，而且從大門走得到旁邊", () => {
    for (const area of areas.values()) {
      if (area.building?.floor !== 1) continue;
      const benches: Array<[number, number]> = [];
      for (let y = 0; y < area.map.height; y++) {
        for (let x = 0; x < area.map.width; x++) {
          if (area.map.getTile(x, y) === TileType.Bench) benches.push([x, y]);
        }
      }
      expect(benches.length, area.id).toBeGreaterThan(0);
      const { entranceArrival } = anchorsOf(area);
      const reachable = reachableFrom(area.map, entranceArrival.x, entranceArrival.y);
      expect(benches.some(([x, y]) => isAdjacent(reachable, x, y)), area.id).toBe(true);
    }
  });

  it("每間房間四周都是牆，只有門（或開放空間那一面）通到外面，不會跟大廳或走廊直接連通", () => {
    expect(outdoor.rooms).toHaveLength(0);
    for (const area of areas.values()) {
      if (!area.building) continue;
      const start = anchorsOf(area).stairs[0].arrival;
      const reachable = reachableFrom(area.map, start.x, start.y);
      for (const room of area.rooms) {
        const label = `${area.id} ${room.name ?? "(未命名)"}`;
        expect(reachable.has(`${room.doorX},${room.doorY}`), label).toBe(true);
        if (!room.open) expect(area.map.getTile(room.doorX, room.doorY), label).toBe(TileType.Door);

        // 沿著房間外圍一圈檢查：除了門口（開放空間則是門口那一整面），其他都不能走
        for (let x = room.x0 - 1; x <= room.x1 + 1; x++) {
          for (let y = room.y0 - 1; y <= room.y1 + 1; y++) {
            if (isInsideRoom(room, x, y)) continue;
            const isDoorSide = room.open
              ? y === room.doorY && x >= room.x0 && x <= room.x1
              : x === room.doorX && y === room.doorY;
            if (isDoorSide) continue;
            expect(area.map.isWalkable(x, y), `${label} 外圍 (${x}, ${y})`).toBe(false);
          }
        }
      }
    }
  });

  it("樓梯：長條型在左右兩端各一座，環形（三教）在四個角落各一座", () => {
    expect(anchorsOf(areas.get("research-3F")!).stairs).toHaveLength(2);
    const research = areas.get("research-3F")!;
    const xs = anchorsOf(research).stairs.flatMap((s) => s.tiles.map((t) => t.x));
    expect(Math.min(...xs)).toBe(1);
    expect(Math.max(...xs)).toBe(research.map.width - 1);
    expect(anchorsOf(areas.get("teaching3-2F")!).stairs).toHaveLength(4);
  });

  it("1F 大廳那一塊只有 1F 有：2F 以上與地下室的入口位置不能走", () => {
    for (const area of areas.values()) {
      if (!area.building) continue;
      const { entranceArrival } = anchorsOf(area);
      const walkable = area.map.isWalkable(entranceArrival.x, entranceArrival.y);
      const occupiedByRoom = area.rooms.some((room) => isInsideRoom(room, entranceArrival.x, entranceArrival.y));
      if (area.building.floor === 1) expect(walkable, area.id).toBe(true);
      else expect(walkable && !occupiedByRoom, area.id).toBe(false);
    }
  });

  it("地下室不放教室：科研大樓 B3 只有影印中心，B1、B2 沒有房間", () => {
    expect(areas.get("research-B3")!.rooms.map((room) => room.name)).toEqual(["影印中心"]);
    expect(areas.get("research-B1")!.rooms).toHaveLength(0);
    expect(areas.get("research-B2")!.rooms).toHaveLength(0);
  });

  it("三教是環形：1F 中間是可以走的中庭，2F 以上才鏤空；房號照教室使用表", () => {
    const tilesOf = (area: Area) => {
      const tiles = new Set<TileType>();
      for (let y = 0; y < area.map.height; y++) {
        for (let x = 0; x < area.map.width; x++) tiles.add(area.map.getTile(x, y));
      }
      return tiles;
    };
    expect(tilesOf(areas.get("teaching3-1F")!).has(TileType.Courtyard)).toBe(true);
    expect(tilesOf(areas.get("teaching3-2F")!).has(TileType.Atrium)).toBe(true);
    const names = areas.get("teaching3-2F")!.rooms.map((room) => room.name);
    expect(names).toContain("201");
    expect(names).toContain("210");
    const firstFloor = areas.get("teaching3-1F")!;
    for (let y = 0; y < firstFloor.map.height; y++) {
      for (let x = 0; x < firstFloor.map.width; x++) {
        if (firstFloor.map.getTile(x, y) === TileType.Courtyard) {
          expect(firstFloor.map.isWalkable(x, y)).toBe(true);
        }
      }
    }
    expect(areas.get("teaching3-1F")!.rooms.map((room) => room.name)).toContain("聯合服務中心");
  });

  it("光華館的學生餐廳有門（不是開放空間），1F、2F 都有餐廳人員", () => {
    for (const floor of [1, 2]) {
      const area = areas.get(`guanghua-${floor}F`)!;
      const restaurant = area.rooms.find((room) => room.name === "學生餐廳")!;
      expect(restaurant.open, area.id).toBe(false);
      expect(area.map.getTile(restaurant.doorX, restaurant.doorY), area.id).toBe(TileType.Door);
      const staff = npcSpawns.find((spawn) => spawn.areaId === area.id && spawn.service === "meal");
      expect(staff, area.id).toBeDefined();
    }
  });

  it("地上樓層的每間房間都有房號或名稱", () => {
    for (const area of areas.values()) {
      if (!area.building || area.building.floor < 0) continue;
      for (const room of area.rooms) {
        expect(room.name, `${area.id} (${room.x0}, ${room.y0})`).toBeTruthy();
      }
    }
  });

  it("查得到的教室號碼有出現在對的樓層（教室使用表）", () => {
    const namesOf = (areaId: string) => areas.get(areaId)!.rooms.map((room) => room.name);
    expect(namesOf("research-2F")).toEqual(expect.arrayContaining(["231", "232", "240", "243"]));
    expect(namesOf("research-12F")).toEqual(expect.arrayContaining(["1222", "1223"]));
    expect(namesOf("guanghua-4F")).toEqual(expect.arrayContaining(["400", "410"]));
    expect(namesOf("teaching2-2F")).toEqual(expect.arrayContaining(["201", "207"]));
    expect(namesOf("complex-3F")).toEqual(expect.arrayContaining(["328_1"]));
  });

  it("正門標籤在校門外的馬路上，不會蓋住站在門內的警衛", () => {
    const gateLabel = outdoor.labels.find((label) => label.text.startsWith("正校門"))!;
    const guard = npcSpawns.find((spawn) => spawn.id === "guard")!;
    // 標籤底邊貼在 label.y 那一格的上緣，所以會畫在 label.y - 1 那一格上
    expect(gateLabel.y - 1).toBeGreaterThan(guard.y);
  });

  it("任務用到的每個 NPC（npcEvents）都真的放在地圖上", () => {
    const ids = new Set(npcSpawns.map((spawn) => spawn.id));
    for (const quest of questData as Array<{ id: string; npcEvents: Record<string, unknown> }>) {
      for (const npcId of Object.keys(quest.npcEvents)) {
        expect(ids.has(npcId), `${quest.id} → ${npcId}`).toBe(true);
      }
    }
  });

  it("成績單只能在行政大樓 2F、5F 與三教 1F 印，申請單只能在科研大樓 B3 印", () => {
    const printers = npcSpawns.filter((spawn) => spawn.service === "print");
    const where = (item: string) =>
      printers.filter((spawn) => spawn.printItem === item).map((spawn) => spawn.areaId).sort();
    expect(where("成績單")).toEqual(["admin-2F", "admin-5F", "teaching3-1F"]);
    expect(where("申請單")).toEqual(["research-B3"]);
  });

  it("警衛只在正校門與新生校門，而且站在校門上、不佔道路", () => {
    const guards = npcSpawns.filter((spawn) => spawn.paletteKey === "guard");
    expect(guards.map((guard) => guard.id).sort()).toEqual(["guard", "xinshengGuard"]);
    for (const guard of guards) {
      expect(outdoor.map.getTile(guard.x, guard.y), guard.id).toBe(TileType.Gate);
    }
  });

  it("戶外主要道路至少 3 格寬，玩家跟走動的學生可以錯身", () => {
    // 主幹道（直向）與北側道路（橫向）各取一段檢查
    const pathLike = (x: number, y: number) =>
      [TileType.Path, TileType.Plaza].includes(outdoor.map.getTile(x, y));
    for (let y = 16; y <= 30; y++) {
      const width = [38, 39, 40, 41].filter((x) => pathLike(x, y)).length;
      expect(width, `主幹道 y=${y}`).toBeGreaterThanOrEqual(3);
    }
    for (let x = 4; x <= 36; x++) {
      const width = [12, 13, 14, 15].filter((y) => pathLike(x, y)).length;
      expect(width, `北側道路 x=${x}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("任務相關的 NPC 都固定在辦公室，不會走動", () => {
    for (const id of ["advisor", "department", "departmentHead", "academicAffairs"]) {
      expect(npcSpawns.find((spawn) => spawn.id === id)?.destinations, id).toBeUndefined();
    }
  });
});
