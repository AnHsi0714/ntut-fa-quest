/**
 * 純程式產生的 16x16 像素風角色 sprite（Pokemon / RPG Maker overworld 角色的簡化版本）。
 * 不使用外部圖檔，改用色塊拼出人形，避免版權問題，之後要換成美術檔也只需替換這個模組。
 */

export type Direction = "down" | "up" | "left" | "right";
export type WalkFrame = 0 | 1;

export interface CharacterPalette {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  outline: string;
}

const SPRITE_SIZE = 16;

function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** legOffset 讓兩隻腳在走路動畫時交錯移動一格，做出簡單的雙幀走路效果。 */
function drawBody(
  ctx: CanvasRenderingContext2D,
  palette: CharacterPalette,
  legOffset: number
): void {
  // 身體（襯衫）
  rect(ctx, 4, 7, 8, 5, palette.shirt);
  // 手臂（露出的皮膚色）
  rect(ctx, 3, 7, 1, 4, palette.skin);
  rect(ctx, 12, 7, 1, 4, palette.skin);
  // 左腳／右腳交錯
  rect(ctx, 5, 12 + legOffset, 3, 3 - legOffset, palette.pants);
  rect(ctx, 8, 12 - legOffset, 3, 3 + legOffset, palette.pants);
  // 鞋子
  rect(ctx, 5, 14 + legOffset, 3, 1, palette.shoes);
  rect(ctx, 8, 14 - legOffset, 3, 1, palette.shoes);
}

function drawHeadFront(ctx: CanvasRenderingContext2D, palette: CharacterPalette): void {
  rect(ctx, 5, 2, 6, 5, palette.skin);
  rect(ctx, 4, 1, 8, 2, palette.hair);
  rect(ctx, 4, 3, 1, 2, palette.hair);
  rect(ctx, 11, 3, 1, 2, palette.hair);
  rect(ctx, 6, 5, 1, 1, palette.outline);
  rect(ctx, 9, 5, 1, 1, palette.outline);
}

function drawHeadBack(ctx: CanvasRenderingContext2D, palette: CharacterPalette): void {
  rect(ctx, 5, 2, 6, 5, palette.skin);
  rect(ctx, 4, 1, 8, 3, palette.hair);
  rect(ctx, 4, 4, 1, 2, palette.hair);
  rect(ctx, 11, 4, 1, 2, palette.hair);
}

function drawHeadSide(
  ctx: CanvasRenderingContext2D,
  palette: CharacterPalette,
  facingRight: boolean
): void {
  rect(ctx, 5, 2, 6, 5, palette.skin);
  rect(ctx, 4, 1, 8, 2, palette.hair);
  if (facingRight) {
    rect(ctx, 4, 3, 2, 3, palette.hair);
    rect(ctx, 10, 5, 1, 1, palette.outline);
  } else {
    rect(ctx, 10, 3, 2, 3, palette.hair);
    rect(ctx, 5, 5, 1, 1, palette.outline);
  }
}

function renderFrame(
  palette: CharacterPalette,
  direction: Direction,
  frame: WalkFrame
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context 不可用");
  ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  const legOffset = frame === 0 ? 0 : 1;
  drawBody(ctx, palette, legOffset);

  switch (direction) {
    case "down":
      drawHeadFront(ctx, palette);
      break;
    case "up":
      drawHeadBack(ctx, palette);
      break;
    case "left":
      drawHeadSide(ctx, palette, false);
      break;
    case "right":
      drawHeadSide(ctx, palette, true);
      break;
  }

  return canvas;
}

export type CharacterSpriteSet = Record<Direction, [HTMLCanvasElement, HTMLCanvasElement]>;

/** 成績單列印機（不是人）：不論朝哪個方向都是同一張圖。 */
export function buildKioskSpriteSet(): CharacterSpriteSet {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context 不可用");
  rect(ctx, 3, 1, 10, 14, "#2f3a4f");
  rect(ctx, 4, 2, 8, 5, "#8fd3ff");
  rect(ctx, 5, 3, 3, 1, "#e8f6ff");
  rect(ctx, 4, 8, 8, 1, "#1c1c1c");
  rect(ctx, 5, 9, 6, 3, "#f5f5f5");
  rect(ctx, 11, 12, 1, 1, "#7ee07e");
  rect(ctx, 3, 15, 10, 1, "#1c1c1c");
  const frames: [HTMLCanvasElement, HTMLCanvasElement] = [canvas, canvas];
  return { down: frames, up: frames, left: frames, right: frames };
}

/** 預先把 4 個方向 x 2 個走路幀都畫好並快取，避免每一格畫面都重新算像素。 */
export function buildCharacterSpriteSet(palette: CharacterPalette): CharacterSpriteSet {
  const directions: Direction[] = ["down", "up", "left", "right"];
  const result = {} as CharacterSpriteSet;
  for (const direction of directions) {
    result[direction] = [
      renderFrame(palette, direction, 0),
      renderFrame(palette, direction, 1),
    ];
  }
  return result;
}

export const PLAYER_PALETTE: CharacterPalette = {
  skin: "#f2c19c",
  hair: "#3b2415",
  shirt: "#3c6e9e",
  pants: "#2b3a55",
  shoes: "#1c1c1c",
  outline: "#1c1c1c",
};

export const NPC_PALETTES: Record<string, CharacterPalette> = {
  advisor: {
    skin: "#f0bd94",
    hair: "#5a5a5a",
    shirt: "#5a7d4f",
    pants: "#3a3a3a",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  department: {
    skin: "#f2c19c",
    hair: "#241a12",
    shirt: "#b46a4f",
    pants: "#4a3b2a",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  departmentHead: {
    skin: "#e9b48a",
    hair: "#2b2b2b",
    shirt: "#6b4c8a",
    pants: "#2b2b2b",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  academicAffairs: {
    skin: "#f2c19c",
    hair: "#4a2f1c",
    shirt: "#c99a2e",
    pants: "#3a3a3a",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  cafeteria: {
    skin: "#f0c09a",
    hair: "#f5f5f5",
    shirt: "#e8e8e8",
    pants: "#3a4a6a",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  guard: {
    skin: "#e9b48a",
    hair: "#1f2a44",
    shirt: "#2f4f7f",
    pants: "#1f2a44",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  desk: {
    skin: "#f2c19c",
    hair: "#3a2415",
    shirt: "#2e7d6b",
    pants: "#3a3a3a",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  senior: {
    skin: "#f0bd94",
    hair: "#1c1c1c",
    shirt: "#3a3a3a",
    pants: "#2b3f66",
    shoes: "#e8e8e8",
    outline: "#1c1c1c",
  },
  homeroom: {
    skin: "#f0bd94",
    hair: "#3a2415",
    shirt: "#3f6fb0",
    pants: "#3a3a3a",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  clubAdvisor: {
    skin: "#e9b48a",
    hair: "#6b6b6b",
    shirt: "#b0503f",
    pants: "#2b2b2b",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  teacher: {
    skin: "#f2c19c",
    hair: "#1c1c1c",
    shirt: "#4f8a6b",
    pants: "#3a3a3a",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  printShop: {
    skin: "#e9b48a",
    hair: "#5a3b24",
    shirt: "#7a8a99",
    pants: "#3a3a3a",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  ta: {
    skin: "#f2c19c",
    hair: "#2b2b2b",
    shirt: "#c46a9a",
    pants: "#3a3a3a",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  gradA: {
    skin: "#f0bd94",
    hair: "#1c1c1c",
    shirt: "#f5f5f5",
    pants: "#2b3f66",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  gradB: {
    skin: "#e9b48a",
    hair: "#4a2f1c",
    shirt: "#6b8e4e",
    pants: "#3a3a3a",
    shoes: "#e8e8e8",
    outline: "#1c1c1c",
  },
  studentA: {
    skin: "#f2c19c",
    hair: "#6b3a1f",
    shirt: "#d9534f",
    pants: "#2b3f66",
    shoes: "#e8e8e8",
    outline: "#1c1c1c",
  },
  studentB: {
    skin: "#e9b48a",
    hair: "#1c1c1c",
    shirt: "#4f8fd9",
    pants: "#3a3a3a",
    shoes: "#1c1c1c",
    outline: "#1c1c1c",
  },
  studentC: {
    skin: "#f0bd94",
    hair: "#8a5a2b",
    shirt: "#e0b33a",
    pants: "#4a3b2a",
    shoes: "#e8e8e8",
    outline: "#1c1c1c",
  },
};
