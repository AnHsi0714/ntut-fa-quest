import { describe, expect, it } from "vitest";
import { buildCampusWorld } from "../game/campusMapData";
import { areaToOverride, rowsToTiles } from "../game/floorOverride";
import { TileType } from "../game/tileTypes";
import { checkFloor, makeRoom, refreshStairTiles, type CheckContext } from "./floorChecks";

describe("樓層編輯器的檢查", () => {
  const { areas } = buildCampusWorld();
  const buildingAreas = [...areas.values()].filter((area) => area.building);

  const contextOf = (areaId: string): CheckContext => {
    const area = areas.get(areaId)!;
    return {
      expectedStairs: area.building!.anchors.stairs.length,
      isGroundFloor: area.building!.floor === 1,
      needsBackPassage: area.warps.length - area.building!.sideEntrances.length > 1,
      sideExitCount: area.building!.sideEntrances.length,
      originalRoomNames: area.rooms.map((room) => room.name).filter((name): name is string => !!name),
    };
  };

  it("遊戲裡的每一層（自動產生與手畫）都通過檢查（編輯器規則跟遊戲測試一致）", () => {
    for (const area of buildingAreas) {
      const override = areaToOverride(area, areas);
      const failed = checkFloor(override, rowsToTiles(override), contextOf(area.id)).filter((check) => !check.ok);
      expect(failed.map((check) => check.message), area.id).toEqual([]);
    }
  });

  it("重新整理樓梯格子後跟原本一樣", () => {
    for (const area of buildingAreas) {
      const override = areaToOverride(area, areas);
      const sort = (tiles: Array<{ x: number; y: number }>) => [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
      const refreshed = refreshStairTiles(rowsToTiles(override), override.anchors.stairs);
      expect(refreshed.map((s) => s.tiles), area.id).toEqual(override.anchors.stairs.map((s) => sort(s.tiles)));
    }
  });

  it("把電梯塗掉、少一座樓梯、刪掉系辦，都會被抓出來", () => {
    const override = areaToOverride(areas.get("research-3F")!, areas);
    const grid = rowsToTiles(override);
    const { elevatorArrival } = override.anchors;
    grid[elevatorArrival.y - 1][elevatorArrival.x] = TileType.InteriorWall;
    override.anchors.stairs.pop();
    override.rooms = override.rooms.filter((room) => room.name !== "331 資工系辦");
    const failed = checkFloor(override, grid, contextOf("research-3F"))
      .filter((check) => !check.ok)
      .map((check) => check.message)
      .join("\n");
    expect(failed).toMatch(/正上方一格是電梯/);
    expect(failed).toMatch(/樓梯 1 座/);
    expect(failed).toMatch(/331 資工系辦/);
  });

  it("房間：門貼在範圍外側才合法，NPC 站在往內三步的位置、面向門口", () => {
    const rect = { x0: 2, y0: 1, x1: 5, y1: 5 };
    expect(makeRoom(rect, { x: 3, y: 6 }, "301", false)?.npcSpot).toEqual({ x: 3, y: 3, direction: "down" });
    expect(makeRoom(rect, { x: 1, y: 3 }, undefined, false)?.npcSpot).toEqual({ x: 4, y: 3, direction: "left" });
    expect(makeRoom(rect, { x: 3, y: 3 }, "301", false)).toBeUndefined();
    expect(makeRoom(rect, { x: 7, y: 6 }, "301", false)).toBeUndefined();
  });
});
