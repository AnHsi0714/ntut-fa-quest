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

function drawRoad(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#4a4a52");
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (hash(x + 90, y + 90) > 0.92) {
        ctx.fillStyle = "#56565f";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  // 虛線標線
  ctx.fillStyle = "#e6e2d3";
  ctx.fillRect(3, 7, 4, 2);
  ctx.fillRect(11, 7, 4, 2);
}

/** 人行穿越道：柏油路面加上垂直於馬路方向的白色斑馬線，玩家從正校門過忠孝東路走這裡。 */
function drawCrosswalk(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#4a4a52");
  ctx.fillStyle = "#e6e2d3";
  ctx.fillRect(0, 1, TILE_SIZE, 3);
  ctx.fillRect(0, 7, TILE_SIZE, 3);
  ctx.fillRect(0, 13, TILE_SIZE, 3);
}

/** 東西向的人行穿越道（建國南路）：斑馬線是直的。 */
function drawCrosswalkVertical(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#4a4a52");
  ctx.fillStyle = "#e6e2d3";
  ctx.fillRect(1, 0, 3, TILE_SIZE);
  ctx.fillRect(7, 0, 3, TILE_SIZE);
  ctx.fillRect(13, 0, 3, TILE_SIZE);
}

/** 球場：PU 地面加一點雜點，球場名稱由標籤標示。 */
function drawCourt(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#3d7a8c");
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (hash(x + 130, y + 130) > 0.93) {
        ctx.fillStyle = "#468a9d";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/** 運動場跑道：紅色 PU 加上分道線。 */
function drawTrack(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#b0543f");
  ctx.fillStyle = "#c9765f";
  ctx.fillRect(0, 5, TILE_SIZE, 1);
  ctx.fillRect(0, 11, TILE_SIZE, 1);
}

function drawGate(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#c9c2b2");
  ctx.fillStyle = "#a79f8c";
  ctx.fillRect(0, 0, TILE_SIZE, 1);
  ctx.fillRect(0, 8, TILE_SIZE, 1);
  ctx.fillRect(7, 0, 1, 8);
  ctx.fillRect(3, 8, 1, 8);
  ctx.fillRect(12, 8, 1, 8);
}

function drawFloor(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#d9cfb8");
  ctx.fillStyle = "#c7bca2";
  ctx.fillRect(0, 0, TILE_SIZE, 1);
  ctx.fillRect(0, 0, 1, TILE_SIZE);
}

function drawInteriorWall(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#5b6075");
  ctx.fillStyle = "#6c7189";
  ctx.fillRect(0, 0, TILE_SIZE, 4);
  ctx.fillStyle = "#484c5e";
  ctx.fillRect(0, TILE_SIZE - 2, TILE_SIZE, 2);
}

function drawStairs(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#8d8a84");
  for (let step = 0; step < 4; step++) {
    ctx.fillStyle = "#b3afa6";
    ctx.fillRect(0, step * 4, TILE_SIZE, 3);
    ctx.fillStyle = "#6a6761";
    ctx.fillRect(0, step * 4 + 3, TILE_SIZE, 1);
  }
}

function drawElevator(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#3d4150");
  ctx.fillStyle = "#a9b0bf";
  ctx.fillRect(2, 2, 5, 13);
  ctx.fillRect(9, 2, 5, 13);
  // 上下箭頭按鈕
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(7, 3, 2, 1);
  ctx.fillRect(7, 12, 2, 1);
}

function drawExit(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#d9cfb8");
  ctx.fillStyle = "#7a2f2f";
  ctx.fillRect(1, 2, TILE_SIZE - 2, TILE_SIZE - 4);
  ctx.fillStyle = "#a14545";
  ctx.fillRect(3, 4, TILE_SIZE - 6, TILE_SIZE - 8);
}

/** 清水紅磚：紅樓。 */
function drawRedBrick(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#d8c8ae");
  for (let row = 0; row < TILE_SIZE; row += 4) {
    const offset = (row / 4) % 2 === 0 ? 0 : 4;
    for (let x = -offset; x < TILE_SIZE; x += 8) {
      ctx.fillStyle = hash(x + 7, row + 3) > 0.5 ? "#a8412f" : "#94382a";
      ctx.fillRect(x, row, 7, 3);
    }
  }
}

/** 黃色丁掛面磚：三教。 */
function drawYellowTile(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#b8963a");
  for (let row = 0; row < TILE_SIZE; row += 3) {
    const offset = (row / 3) % 2 === 0 ? 0 : 2;
    for (let x = -offset; x < TILE_SIZE; x += 4) {
      ctx.fillStyle = "#dcbb55";
      ctx.fillRect(x, row, 3, 2);
    }
  }
}

/** 黃色二丁掛面磚加灰色玻璃馬賽克腰帶與水平窗帶：行政大樓、圖書館、綜合科館。 */
function drawTanMosaic(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#cfae6e");
  ctx.fillStyle = "#b8975a";
  for (let row = 3; row < TILE_SIZE; row += 4) ctx.fillRect(0, row, TILE_SIZE, 1);
  // 水平窗帶
  ctx.fillStyle = "#34425a";
  ctx.fillRect(0, 5, TILE_SIZE, 3);
  ctx.fillStyle = "#56688a";
  ctx.fillRect(1, 5, 5, 1);
  ctx.fillRect(9, 5, 5, 1);
  // 灰色玻璃馬賽克
  for (let x = 0; x < TILE_SIZE; x += 2) {
    ctx.fillStyle = hash(x, 11) > 0.5 ? "#8d8f96" : "#a3a5ab";
    ctx.fillRect(x, 11, 2, 2);
  }
}

/** 洗石子外牆加直式遮陽板：光復初期的教學大樓、系館。 */
function drawWashedStone(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#aaa393");
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = hash(x + 30, y + 70);
      if (n > 0.8) {
        ctx.fillStyle = "#938c7c";
        ctx.fillRect(x, y, 1, 1);
      } else if (n < 0.12) {
        ctx.fillStyle = "#bfb8a8";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  // 直式遮陽板之間的長窗
  ctx.fillStyle = "#3f4a57";
  ctx.fillRect(2, 2, 4, 12);
  ctx.fillRect(10, 2, 4, 12);
}

/** 玻璃帷幕：科研大樓（遊戲設定）。 */
function drawGlass(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#4d6f8c");
  ctx.fillStyle = "#6f93b0";
  ctx.fillRect(1, 1, 6, 6);
  ctx.fillRect(9, 9, 6, 6);
  ctx.fillStyle = "#d7dde3";
  ctx.fillRect(0, 7, TILE_SIZE, 1);
  ctx.fillRect(7, 0, 1, TILE_SIZE);
  ctx.fillRect(15, 0, 1, TILE_SIZE);
  ctx.fillRect(0, 15, TILE_SIZE, 1);
}

/** 清水混凝土加方窗：其他建築物（遊戲設定）。 */
function drawConcrete(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#9d9a93");
  ctx.fillStyle = "#8a8780";
  ctx.fillRect(0, 0, TILE_SIZE, 1);
  ctx.fillStyle = "#3c4450";
  ctx.fillRect(3, 4, 4, 5);
  ctx.fillRect(9, 4, 4, 5);
  ctx.fillStyle = "#c9c6bf";
  ctx.fillRect(3, 9, 4, 1);
  ctx.fillRect(9, 9, 4, 1);
}

/** 1F 大廳休息區沙發。 */
function drawBench(ctx: CanvasRenderingContext2D): void {
  drawFloor(ctx);
  ctx.fillStyle = "#2e6b5e";
  ctx.fillRect(1, 3, 14, 4);
  ctx.fillStyle = "#3f8a7a";
  ctx.fillRect(1, 7, 14, 5);
  ctx.fillStyle = "#24554a";
  ctx.fillRect(0, 4, 2, 9);
  ctx.fillRect(14, 4, 2, 9);
  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(2, 13, 2, 2);
  ctx.fillRect(12, 13, 2, 2);
}

/** 挑空：往下看到樓下中庭，外圈畫一圈欄杆。 */
function drawAtrium(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#1f2a24");
  ctx.fillStyle = "#2c3b33";
  for (let y = 0; y < TILE_SIZE; y += 4) ctx.fillRect(0, y, TILE_SIZE, 2);
  ctx.fillStyle = "#b9bcc4";
  ctx.fillRect(0, 0, TILE_SIZE, 1);
}

/** 1F 中庭：石板地面，可以走。 */
function drawCourtyard(ctx: CanvasRenderingContext2D): void {
  fillBase(ctx, "#c4bfb3");
  ctx.fillStyle = "#aca698";
  ctx.fillRect(0, 7, TILE_SIZE, 1);
  ctx.fillRect(7, 0, 1, 7);
  ctx.fillRect(3, 8, 1, 8);
  ctx.fillRect(12, 8, 1, 8);
}

const DRAWERS: Record<TileType, (ctx: CanvasRenderingContext2D) => void> = {
  [TileType.Grass]: drawGrass,
  [TileType.Path]: drawPath,
  [TileType.Plaza]: drawPlaza,
  [TileType.Wall]: drawWall,
  [TileType.Door]: drawDoor,
  [TileType.Border]: drawBorder,
  [TileType.Road]: drawRoad,
  [TileType.Crosswalk]: drawCrosswalk,
  [TileType.CrosswalkVertical]: drawCrosswalkVertical,
  [TileType.Court]: drawCourt,
  [TileType.Track]: drawTrack,
  [TileType.Gate]: drawGate,
  [TileType.Floor]: drawFloor,
  [TileType.InteriorWall]: drawInteriorWall,
  [TileType.Stairs]: drawStairs,
  [TileType.Elevator]: drawElevator,
  [TileType.Exit]: drawExit,
  [TileType.WallRedBrick]: drawRedBrick,
  [TileType.WallYellowTile]: drawYellowTile,
  [TileType.WallTanMosaic]: drawTanMosaic,
  [TileType.WallWashedStone]: drawWashedStone,
  [TileType.WallGlass]: drawGlass,
  [TileType.WallConcrete]: drawConcrete,
  [TileType.Bench]: drawBench,
  [TileType.Atrium]: drawAtrium,
  [TileType.Courtyard]: drawCourtyard,
};

let cache: Map<TileType, HTMLCanvasElement> | null = null;
let emptySeat: HTMLCanvasElement | null = null;
let openDoor: HTMLCanvasElement | null = null;
let roomCover: HTMLCanvasElement | null = null;

function makeSprite(draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context 不可用");
  draw(ctx);
  return canvas;
}

/** 玩家站在門口或房間裡時，門畫成打開的樣子。 */
export function getOpenDoorSprite(): HTMLCanvasElement {
  openDoor ??= makeSprite((ctx) => {
    fillBase(ctx, "#5a3b24");
    ctx.fillStyle = "#d9cfb8";
    ctx.fillRect(2, 1, TILE_SIZE - 4, TILE_SIZE - 1);
    ctx.fillStyle = "#7a5334";
    ctx.fillRect(2, 1, 3, TILE_SIZE - 1);
  });
  return openDoor;
}

/** 關著門的房間，從走廊看進去只看得到天花板，看不到裡面有沒有人。 */
export function getRoomCoverSprite(): HTMLCanvasElement {
  roomCover ??= makeSprite((ctx) => {
    fillBase(ctx, "#474b5c");
    ctx.fillStyle = "#3d4150";
    ctx.fillRect(0, 0, TILE_SIZE, 1);
    ctx.fillRect(0, 0, 1, TILE_SIZE);
    ctx.fillStyle = "#555a6d";
    ctx.fillRect(6, 6, 4, 4);
  });
  return roomCover;
}

/** 不在場 NPC 位置上畫的空辦公椅（透明背景，疊在地板上）。 */
export function getEmptySeatSprite(): HTMLCanvasElement {
  if (emptySeat) return emptySeat;
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context 不可用");
  // 椅背
  ctx.fillStyle = "#2f3342";
  ctx.fillRect(4, 2, 8, 6);
  ctx.fillStyle = "#454a5e";
  ctx.fillRect(5, 3, 6, 4);
  // 椅墊
  ctx.fillStyle = "#2f3342";
  ctx.fillRect(3, 8, 10, 3);
  // 支柱與腳輪
  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(7, 11, 2, 3);
  ctx.fillRect(4, 14, 8, 1);
  ctx.fillRect(3, 15, 2, 1);
  ctx.fillRect(11, 15, 2, 1);
  emptySeat = canvas;
  return emptySeat;
}

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
