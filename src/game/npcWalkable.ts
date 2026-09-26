import type { Area } from "./area";
import { MAIN_GATE_SPAWN } from "./campusMapData";
import { TileType } from "./tileTypes";

/**
 * 走動的 NPC 在地形上能不能走這一格（找路用，不管其他角色）：
 * 不能走進門口、出口、校門，也不能經過玩家換樓層 / 進門 / 閉校回到正門時會出現的位置，
 * 避免擋路或跟玩家疊在同一格。
 */
export function isNpcWalkableTile(area: Area, x: number, y: number): boolean {
  if (!area.map.isWalkable(x, y)) return false;
  const tile = area.map.getTile(x, y);
  if (tile === TileType.Door || tile === TileType.Exit || tile === TileType.Gate) return false;
  if (area.warps.some((warp) => warp.x === x && warp.y === y)) return false;
  const anchors = area.building?.anchors;
  const reserved = anchors
    ? [
        ...anchors.stairs.map((staircase) => staircase.arrival),
        anchors.elevatorArrival,
        anchors.entranceArrival,
        ...area.building!.sideEntrances,
      ]
    : [MAIN_GATE_SPAWN];
  return !reserved.some((spot) => spot.x === x && spot.y === y);
}
