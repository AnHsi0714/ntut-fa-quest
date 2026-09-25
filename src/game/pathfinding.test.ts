import { describe, expect, it } from "vitest";
import { findPath } from "./pathfinding";

/** 用字串畫地圖：# 是牆，其他都可以走。 */
function gridWalker(rows: string[]) {
  return (x: number, y: number) =>
    y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== "#";
}

describe("findPath", () => {
  it("起點就是終點時回傳空陣列", () => {
    expect(findPath({ x: 1, y: 1 }, { x: 1, y: 1 }, () => true)).toEqual([]);
  });

  it("回傳最短路徑，不含起點、含終點", () => {
    const path = findPath({ x: 0, y: 0 }, { x: 3, y: 0 }, gridWalker(["...."]));
    expect(path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it("會繞過牆壁", () => {
    const walk = gridWalker([
      ".#.", //
      ".#.",
      "...",
    ]);
    const path = findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, walk)!;
    expect(path).toHaveLength(6);
    expect(path[path.length - 1]).toEqual({ x: 2, y: 0 });
    expect(path.every((p) => walk(p.x, p.y))).toBe(true);
  });

  it("走不到時回傳 null", () => {
    const walk = gridWalker([".#."]);
    expect(findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, walk)).toBeNull();
    expect(findPath({ x: 0, y: 0 }, { x: 1, y: 0 }, walk)).toBeNull();
  });
});
