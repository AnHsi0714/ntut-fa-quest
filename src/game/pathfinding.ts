export interface TilePoint {
  x: number;
  y: number;
}

const STEPS: TilePoint[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/**
 * 格子地圖上的最短路徑（BFS，上下左右四方向）。回傳從起點的下一格一路到終點的格子序列，
 * 起點本身不包含在內；起點就是終點時回傳空陣列，走不到時回傳 null。
 * canWalk 只判斷地形能不能走，其他角色擋路這種會變動的狀況交給實際移動時再處理。
 */
export function findPath(
  start: TilePoint,
  goal: TilePoint,
  canWalk: (x: number, y: number) => boolean,
  maxVisited = 5000
): TilePoint[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];
  if (!canWalk(goal.x, goal.y)) return null;

  const key = (x: number, y: number) => `${x},${y}`;
  const cameFrom = new Map<string, TilePoint | null>([[key(start.x, start.y), null]]);
  const queue: TilePoint[] = [start];

  for (let head = 0; head < queue.length && cameFrom.size <= maxVisited; head++) {
    const current = queue[head];
    for (const step of STEPS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      const nextKey = key(next.x, next.y);
      if (cameFrom.has(nextKey) || !canWalk(next.x, next.y)) continue;
      cameFrom.set(nextKey, current);
      if (next.x === goal.x && next.y === goal.y) {
        const path: TilePoint[] = [];
        let cursor: TilePoint | null = next;
        while (cursor && !(cursor.x === start.x && cursor.y === start.y)) {
          path.push(cursor);
          cursor = cameFrom.get(key(cursor.x, cursor.y)) ?? null;
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}
