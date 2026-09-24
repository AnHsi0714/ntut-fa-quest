import { describe, expect, it } from "vitest";
import { computeLayeredLayout } from "./automatonLayout";

describe("computeLayeredLayout", () => {
  it("排出一條線性鏈：每個 state 各自佔一層，x 依序遞增、y 都在同一條線上", () => {
    const positions = computeLayeredLayout(
      ["start", "advisor", "department", "complete"],
      [
        { from: "start", to: "advisor" },
        { from: "advisor", to: "department" },
        { from: "department", to: "complete" },
      ]
    );

    const xs = ["start", "advisor", "department", "complete"].map(
      (state) => positions.get(state)?.x
    );
    expect(xs[0]).toBeLessThan(xs[1] as number);
    expect(xs[1]).toBeLessThan(xs[2] as number);
    expect(xs[2]).toBeLessThan(xs[3] as number);

    const ys = new Set(["start", "advisor", "department", "complete"].map(
      (state) => positions.get(state)?.y
    ));
    expect(ys.size).toBe(1);
  });

  it("分岔又合流時，同層的 state 要分開排在不同 y，合流點的 y 落在兩者中間", () => {
    const positions = computeLayeredLayout(
      ["start", "a", "b", "finish"],
      [
        { from: "start", to: "a" },
        { from: "start", to: "b" },
        { from: "a", to: "finish" },
        { from: "b", to: "finish" },
      ]
    );

    const a = positions.get("a") as { x: number; y: number };
    const b = positions.get("b") as { x: number; y: number };
    const finish = positions.get("finish") as { x: number; y: number };

    expect(a.x).toBe(b.x);
    expect(a.y).not.toBe(b.y);
    expect(finish.y).toBeCloseTo((a.y + b.y) / 2);
  });

  it("沒有入邊的 state（initial state）一定落在最左邊那一層", () => {
    const positions = computeLayeredLayout(["s", "x"], [{ from: "s", to: "x" }]);
    const s = positions.get("s") as { x: number; y: number };
    const x = positions.get("x") as { x: number; y: number };
    expect(x.x).toBeGreaterThan(s.x);
  });

  it("走不到的 state（設計不良的自動機）仍然要有座標，不會整個漏畫", () => {
    const positions = computeLayeredLayout(["s", "unreachable"], []);
    expect(positions.has("s")).toBe(true);
    expect(positions.has("unreachable")).toBe(true);
  });
});
