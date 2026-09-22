import { TileType } from "./tileTypes";

const TILE_SIZE = 16;

/** 簡單的整數雜湊，讓草地斑點看起來隨機但每次重繪都一樣（不用真的存一份雜訊圖）。 */
function hash(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function fillBase(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
}

function drawGrass(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#3f8f3f");
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x, y);
      if (n > 0.86) {
        ctx.fillStyle = "#347a34";
        ctx.fillRect(x, y, 1, 1);
      } else if (n < 0.08) {
        ctx.fillStyle = "#4fa855";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function drawPath(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#d8c398");
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x + 50, y + 50);
      if (n > 0.9) {
        ctx.fillStyle = "#c2ab7a";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function drawPlaza(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#b9b6b0");
  ctx.strokeStyle = "#9a9791";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
}

function drawWall(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#8a7d6b");
  ctx.fillStyle = "#6f6252";
  for (let row = 0; row < TILE_SIZE; row += 4) {
    const offset = (row / 4) % 2 === 0 ? 0 : 8;
    ctx.fillRect(0, row + 3, TILE_SIZE, 1);
    for (let x = -8 + offset; x < TILE_SIZE; x += 8) {
      ctx.fillRect(x, row, 1, 4);
    }
  }
}

function drawDoor(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#5a3b24");
  ctx.fillStyle = "#7a5334";
  ctx.fillRect(2, 1, TILE_SIZE - 4, TILE_SIZE - 2);
  ctx.fillStyle = "#d8b45a";
  ctx.fillRect(11, 8, 2, 2);
}

function drawBorder(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#2e5a2e");
  ctx.fillStyle = "#25a025";
  ctx.beginPath();
  ctx.arc(8, 7, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a2417";
  ctx.fillRect(7, 12, 2, 4);
}

const DRAWERS: Record<TileType, (ctx: CanvasRenderingContext2D) => void> = {
  [TileType.Grass]: drawGrass,
  [TileType.Path]: drawPath,
  [TileType.Plaza]: drawPlaza,
  [TileType.Wall]: drawWall,
  [TileType.Door]: drawDoor,
  [TileType.Border]: drawBorder,
};

let cache: Map<TileType, HTMLCanvasElement> | null = null;

/** 建立（並快取）每一種圖塊的 16x16 像素圖，供 renderer 直接 blit 使用。 */
export function getTileSet(): Map<TileType, HTMLCanvasElement> {
  if (cache) return cache;
  cache = new Map();
  for (const tileType of Object.values(TileType)) {
    const canvas = document.createElement("canvas");
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context 不可用");
    DRAWERS[tileType](ctx);
    cache.set(tileType, canvas);
  }
  return cache;
}

export { TILE_SIZE };
