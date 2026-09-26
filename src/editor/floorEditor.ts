import { buildCampusWorld } from "../game/campusMapData";
import { areaToOverride, rowsToTiles, tilesToRows, type FloorOverride } from "../game/floorOverride";
import { getTileSet, TILE_SIZE } from "../game/tileArt";
import { TileType } from "../game/tileTypes";
import { floorLabel, isInsideRoom, type Area, type TileSpot } from "../game/area";
import type { Direction } from "../game/pixelSprite";
import { checkFloor, makeRoom, refreshStairTiles, type CheckContext } from "./floorChecks";

/**
 * 開發用的樓層編輯器：選一棟建築物的某一層、載入現況，用圖塊與標記改好之後匯出成 JSON，
 * 放進 src/game/floorOverrides/ 就會取代那一層的自動產生版本（見 src/game/floorOverride.ts）。
 */

const SCALE = 2;
const CELL = TILE_SIZE * SCALE;

/** 室內常用的圖塊放前面，戶外圖塊放後面（室內用不到，但保留給特殊設計）。 */
const TILE_TOOLS: Array<{ tile: TileType; name: string }> = [
  { tile: TileType.Floor, name: "地板" },
  { tile: TileType.InteriorWall, name: "牆" },
  { tile: TileType.Door, name: "門" },
  { tile: TileType.Stairs, name: "樓梯" },
  { tile: TileType.Elevator, name: "電梯" },
  { tile: TileType.Exit, name: "出口" },
  { tile: TileType.Bench, name: "沙發" },
  { tile: TileType.Courtyard, name: "中庭" },
  { tile: TileType.Atrium, name: "挑空" },
  { tile: TileType.Grass, name: "草地" },
  { tile: TileType.Path, name: "步道" },
  { tile: TileType.Plaza, name: "廣場" },
];

type MarkerTool =
  | "stairArrival"
  | "elevatorArrival"
  | "entranceArrival"
  | "infoDesk"
  | "exit"
  | "passageExit"
  | "passageArrival"
  | "room"
  | "deleteRoom"
  | "label";

const MARKER_TOOLS: Array<{ id: MarkerTool; name: string; help: string }> = [
  { id: "stairArrival", name: "樓梯抵達點", help: "選好樓梯編號後點一格：從別層走這座樓梯上下來時站的位置，旁邊要有樓梯格。「新增一座」會加在最後。" },
  { id: "elevatorArrival", name: "電梯抵達點", help: "點一格：搭電梯出來站的位置，正上方一格要是電梯。" },
  { id: "entranceArrival", name: "入口抵達點", help: "1F 才用：從大門進來站的位置，跟出口至少隔一格。" },
  { id: "infoDesk", name: "服務台位置", help: "1F 才用：服務台人員站的位置。" },
  { id: "exit", name: "出口位置", help: "1F 才用：點一格設成出口，走上去會回到戶外（科研大樓是回到六教）。" },
  { id: "passageExit", name: "後方通道出口", help: "六教 1F 才用：點一格設成出口，走上去會進到科研大樓 1F。" },
  { id: "passageArrival", name: "後方通道抵達點", help: "六教 1F 才用：從科研大樓走回來時站的位置。" },
  { id: "room", name: "房間", help: "先拖曳出房間範圍（房間裡面的格子），再點一下門的位置（貼在範圍外側一格）。會問名稱與是不是開放空間。" },
  { id: "deleteRoom", name: "刪除房間", help: "點房間裡任一格，刪掉這間房（圖塊不會動）。" },
  { id: "label", name: "文字標籤", help: "點一格新增標籤；點在既有標籤上會問要不要刪掉。" },
];

type Tool = { kind: "tile"; tile: TileType } | { kind: "marker"; marker: MarkerTool };

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`找不到 #${id}`);
  return element as T;
}

const world = buildCampusWorld();
const tileSet = getTileSet();
const canvas = byId<HTMLCanvasElement>("editor-canvas");
const ctx = canvas.getContext("2d")!;

let override!: FloorOverride;
let grid: TileType[][] = [];
let tool: Tool = { kind: "tile", tile: TileType.Floor };
let history: string[] = [];
let dragStart: { x: number; y: number } | undefined;
let dragEnd: { x: number; y: number } | undefined;
let pendingRoom: { x0: number; y0: number; x1: number; y1: number } | undefined;
let hover: { x: number; y: number } | undefined;

const buildingAreas = [...world.areas.values()].filter((area) => area.building);

function currentArea(): Area {
  return world.areas.get(override.areaId)!;
}

function checkContext(): CheckContext {
  const area = currentArea();
  const building = area.building!;
  const sibling = buildingAreas.find(
    (other) => other.building!.buildingId === building.buildingId && other.id !== area.id
  );
  return {
    expectedStairs: (sibling ?? area).building!.anchors.stairs.length,
    isGroundFloor: building.floor === 1,
    needsBackPassage: area.warps.length > 1,
    originalRoomNames: area.rooms.map((room) => room.name).filter((name): name is string => !!name),
  };
}

// ---------- 狀態 ----------

function snapshot(): string {
  return JSON.stringify({ ...override, tiles: tilesToRows(grid) });
}

function pushHistory(): void {
  history.push(snapshot());
  if (history.length > 200) history.shift();
}

function loadOverride(next: FloorOverride): void {
  override = structuredClone(next);
  grid = rowsToTiles(override);
  history = [];
  pendingRoom = undefined;
  byId<HTMLInputElement>("grid-width").value = String(override.width);
  byId<HTMLInputElement>("grid-height").value = String(override.height);
  byId<HTMLSelectElement>("floor-select").value = override.areaId;
  refreshStairOptions();
  render();
}

function undo(): void {
  const previous = history.pop();
  if (!previous) return;
  override = JSON.parse(previous);
  grid = rowsToTiles(override);
  refreshStairOptions();
  render();
}

function exportData(): FloorOverride {
  return {
    ...override,
    tiles: tilesToRows(grid),
    anchors: { ...override.anchors, stairs: refreshStairTiles(grid, override.anchors.stairs) },
  };
}

// ---------- 編輯動作 ----------

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < override.width && y < override.height;
}

function paint(x: number, y: number, tile: TileType): void {
  if (inBounds(x, y)) grid[y][x] = tile;
}

function direction(): Direction {
  return byId<HTMLSelectElement>("marker-direction").value as Direction;
}

function spot(x: number, y: number): TileSpot {
  return { x, y, direction: direction() };
}

function applyMarker(marker: MarkerTool, x: number, y: number): void {
  const { anchors } = override;
  switch (marker) {
    case "stairArrival": {
      const index = Number(byId<HTMLSelectElement>("stair-index").value);
      if (index >= anchors.stairs.length) anchors.stairs.push({ tiles: [], arrival: spot(x, y) });
      else anchors.stairs[index].arrival = spot(x, y);
      refreshStairOptions();
      break;
    }
    case "elevatorArrival":
      anchors.elevatorArrival = spot(x, y);
      break;
    case "entranceArrival":
      anchors.entranceArrival = spot(x, y);
      break;
    case "infoDesk":
      anchors.infoDesk = spot(x, y);
      break;
    case "exit":
      override.exit = { x, y };
      paint(x, y, TileType.Exit);
      break;
    case "passageExit":
      override.backPassage = { exit: { x, y }, arrival: override.backPassage?.arrival ?? spot(x, y + 2) };
      paint(x, y, TileType.Exit);
      break;
    case "passageArrival":
      override.backPassage = { exit: override.backPassage?.exit ?? { x, y: y - 2 }, arrival: spot(x, y) };
      break;
    case "deleteRoom": {
      const room = override.rooms.find((candidate) => isInsideRoom(candidate, x, y));
      if (!room) return;
      override.rooms = override.rooms.filter((candidate) => candidate !== room);
      override.labels = override.labels.filter(
        (label) => !(label.text === room.name && label.y === room.y0 && label.x === (room.x0 + room.x1) / 2)
      );
      break;
    }
    case "label": {
      const existing = override.labels.find((label) => Math.round(label.x) === x && Math.round(label.y) === y);
      if (existing) {
        if (confirm(`刪掉標籤「${existing.text}」？`)) override.labels = override.labels.filter((l) => l !== existing);
        break;
      }
      const text = prompt("標籤文字");
      if (text) override.labels.push({ text, x, y });
      break;
    }
    case "room": {
      if (!pendingRoom) return;
      const name = prompt("房間名稱（留空代表查不到名稱）") ?? "";
      const open = confirm("是開放空間嗎？（沒有門，靠門那一整面打通；按取消代表一般有門的房間）");
      const room = makeRoom(pendingRoom, { x, y }, name.trim() || undefined, open);
      if (!room) {
        alert("門要貼在房間範圍外側一格、而且在房間那一邊的範圍內。");
        return;
      }
      for (let ry = room.y0; ry <= room.y1; ry++) for (let rx = room.x0; rx <= room.x1; rx++) paint(rx, ry, TileType.Floor);
      if (open) {
        if (room.doorY === room.y0 - 1 || room.doorY === room.y1 + 1) {
          for (let rx = room.x0; rx <= room.x1; rx++) paint(rx, room.doorY, TileType.Floor);
        } else {
          for (let ry = room.y0; ry <= room.y1; ry++) paint(room.doorX, ry, TileType.Floor);
        }
      } else {
        paint(room.doorX, room.doorY, TileType.Door);
      }
      override.rooms.push(room);
      if (room.name) override.labels.push({ text: room.name, x: (room.x0 + room.x1) / 2, y: room.y0 });
      pendingRoom = undefined;
      break;
    }
  }
}

function resize(width: number, height: number): void {
  pushHistory();
  const next: TileType[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < width; x++) row.push(grid[y]?.[x] ?? TileType.InteriorWall);
    next.push(row);
  }
  grid = next;
  override.width = width;
  override.height = height;
  render();
}

// ---------- 滑鼠 ----------

function cellOf(event: MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor(((event.clientX - rect.left) / rect.width) * override.width),
    y: Math.floor(((event.clientY - rect.top) / rect.height) * override.height),
  };
}

function shape(): "pen" | "rect" {
  return (document.querySelector<HTMLInputElement>('input[name="shape"]:checked')?.value ?? "pen") as "pen" | "rect";
}

function normalizedRect(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
}

canvas.addEventListener("mousedown", (event) => {
  const cell = cellOf(event);
  if (!inBounds(cell.x, cell.y)) return;
  if (tool.kind === "marker" && tool.marker === "room" && pendingRoom) {
    pushHistory();
    applyMarker("room", cell.x, cell.y);
    render();
    return;
  }
  if (tool.kind === "marker" && tool.marker !== "room") {
    pushHistory();
    applyMarker(tool.marker, cell.x, cell.y);
    render();
    return;
  }
  pushHistory();
  dragStart = cell;
  dragEnd = cell;
  if (tool.kind === "tile" && shape() === "pen") paint(cell.x, cell.y, tool.tile);
  render();
});

canvas.addEventListener("mousemove", (event) => {
  hover = cellOf(event);
  if (dragStart) {
    dragEnd = hover;
    if (tool.kind === "tile" && shape() === "pen") paint(hover.x, hover.y, tool.tile);
  }
  render();
});

window.addEventListener("mouseup", () => {
  if (!dragStart || !dragEnd) return;
  const rect = normalizedRect(dragStart, dragEnd);
  if (tool.kind === "tile" && shape() === "rect") {
    for (let y = rect.y0; y <= rect.y1; y++) for (let x = rect.x0; x <= rect.x1; x++) paint(x, y, tool.tile);
  } else if (tool.kind === "marker" && tool.marker === "room") {
    pendingRoom = rect;
  }
  dragStart = undefined;
  dragEnd = undefined;
  render();
});

canvas.addEventListener("mouseleave", () => {
  hover = undefined;
  render();
});

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
  }
  if (event.key === "Escape") {
    pendingRoom = undefined;
    render();
  }
});

// ---------- 繪製 ----------

function drawTag(text: string, x: number, y: number, color: string): void {
  ctx.font = "bold 12px system-ui, sans-serif";
  const width = ctx.measureText(text).width + 6;
  ctx.fillStyle = "rgba(15, 15, 26, 0.9)";
  ctx.fillRect(x, y, width, 16);
  ctx.fillStyle = color;
  ctx.fillText(text, x + 3, y + 12);
}

function drawMarker(text: string, cell: { x: number; y: number }, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(cell.x * CELL + 2, cell.y * CELL + 2, CELL - 4, CELL - 4);
  drawTag(text, cell.x * CELL + 2, cell.y * CELL + 2, color);
}

function render(): void {
  canvas.width = override.width * CELL;
  canvas.height = override.height * CELL;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < override.height; y++) {
    for (let x = 0; x < override.width; x++) {
      const sprite = tileSet.get(grid[y][x]);
      if (sprite) ctx.drawImage(sprite, x * CELL, y * CELL, CELL, CELL);
    }
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= override.width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL + 0.5, 0);
    ctx.lineTo(x * CELL + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= override.height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL + 0.5);
    ctx.lineTo(canvas.width, y * CELL + 0.5);
    ctx.stroke();
  }

  for (const room of override.rooms) {
    ctx.strokeStyle = "#7fd1ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(room.x0 * CELL + 1, room.y0 * CELL + 1, (room.x1 - room.x0 + 1) * CELL - 2, (room.y1 - room.y0 + 1) * CELL - 2);
    drawMarker("N", room.npcSpot, "#7fd1ff");
  }
  for (const label of override.labels) {
    drawTag(label.text, label.x * CELL, label.y * CELL - 16, "#ffd166");
  }

  const { anchors } = override;
  anchors.stairs.forEach((staircase, index) => drawMarker(`樓${index + 1}`, staircase.arrival, "#9be7a6"));
  drawMarker("梯", anchors.elevatorArrival, "#c9a7ff");
  if (currentArea().building!.floor === 1) {
    drawMarker("入", anchors.entranceArrival, "#ffb38a");
    drawMarker("台", anchors.infoDesk, "#ffb38a");
  }
  if (override.exit) drawMarker("出", override.exit, "#ff9b9b");
  if (override.backPassage) {
    drawMarker("通", override.backPassage.exit, "#ff9b9b");
    drawMarker("回", override.backPassage.arrival, "#ff9b9b");
  }

  const preview = dragStart && dragEnd ? normalizedRect(dragStart, dragEnd) : pendingRoom;
  if (preview) {
    ctx.strokeStyle = "#ffffff";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(preview.x0 * CELL, preview.y0 * CELL, (preview.x1 - preview.x0 + 1) * CELL, (preview.y1 - preview.y0 + 1) * CELL);
    ctx.setLineDash([]);
  }

  const area = currentArea();
  const where = hover && inBounds(hover.x, hover.y) ? `（${hover.x}, ${hover.y}）${grid[hover.y][hover.x]}` : "";
  const roomHint = pendingRoom ? "　已選好房間範圍，點一下門的位置（Esc 取消）" : "";
  byId("status-line").textContent = `${area.building!.buildingName} ${floorLabel(area.building!.floor)}　${override.width}×${override.height}　${where}${roomHint}`;

  const list = byId("check-list");
  list.replaceChildren(
    ...checkFloor(exportData(), grid, checkContext()).map((check) => {
      const item = document.createElement("li");
      item.className = check.ok ? "ok" : "error";
      item.textContent = `${check.ok ? "✓" : "✗"} ${check.message}`;
      return item;
    })
  );
}

// ---------- 介面 ----------

function selectTool(next: Tool, button: HTMLButtonElement, help: string): void {
  tool = next;
  pendingRoom = undefined;
  for (const other of document.querySelectorAll<HTMLButtonElement>("#palette button")) {
    other.setAttribute("aria-pressed", String(other === button));
  }
  byId("tool-help").textContent = help;
  render();
}

function refreshStairOptions(): void {
  const select = byId<HTMLSelectElement>("stair-index");
  const previous = select.value;
  select.replaceChildren(
    ...override.anchors.stairs.map((_, index) => new Option(`第 ${index + 1} 座`, String(index))),
    new Option("新增一座", String(override.anchors.stairs.length))
  );
  if ([...select.options].some((option) => option.value === previous)) select.value = previous;
}

function setupPalette(): void {
  const tiles = byId("tile-tools");
  for (const { tile, name } of TILE_TOOLS) {
    const button = document.createElement("button");
    button.type = "button";
    const swatch = document.createElement("canvas");
    swatch.width = TILE_SIZE;
    swatch.height = TILE_SIZE;
    const sprite = tileSet.get(tile);
    if (sprite) swatch.getContext("2d")!.drawImage(sprite, 0, 0);
    button.append(swatch, name);
    button.addEventListener("click", () => selectTool({ kind: "tile", tile }, button, `畫「${name}」：畫筆一格一格畫，矩形拖曳填滿。`));
    tiles.append(button);
    if (tile === TileType.Floor) button.setAttribute("aria-pressed", "true");
  }
  const markers = byId("marker-tools");
  for (const { id, name, help } of MARKER_TOOLS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => selectTool({ kind: "marker", marker: id }, button, help));
    markers.append(button);
  }
}

function setupToolbar(): void {
  const select = byId<HTMLSelectElement>("floor-select");
  const overridden = new Set(Object.keys(import.meta.glob("../game/floorOverrides/*.json")).map((path) => path.replace(/^.*\//, "").replace(/\.json$/, "")));
  for (const area of buildingAreas) {
    const mark = overridden.has(area.id) ? "（手畫）" : "";
    select.append(new Option(`${area.name}${mark}`, area.id));
  }
  const loadSelected = () => loadOverride(areaToOverride(world.areas.get(select.value)!, world.areas));
  select.addEventListener("change", loadSelected);
  byId("load-current").addEventListener("click", loadSelected);

  byId<HTMLInputElement>("load-file").addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const data = JSON.parse(await file.text()) as FloorOverride;
    if (!world.areas.has(data.areaId)) {
      alert(`這個檔案的樓層 ${data.areaId} 不存在`);
      return;
    }
    loadOverride(data);
  });

  byId("apply-size").addEventListener("click", () => {
    const width = Number(byId<HTMLInputElement>("grid-width").value);
    const height = Number(byId<HTMLInputElement>("grid-height").value);
    if (width >= 5 && height >= 5) resize(width, height);
  });
  byId("undo").addEventListener("click", undo);

  const json = () => `${JSON.stringify(exportData(), null, 2)}\n`;
  byId("export").addEventListener("click", () => {
    const failed = checkFloor(exportData(), grid, checkContext()).filter((check) => !check.ok);
    if (failed.length > 0 && !confirm(`還有 ${failed.length} 項檢查沒過，放進遊戲後測試會失敗。還是要匯出嗎？`)) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([json()], { type: "application/json" }));
    link.download = `${override.areaId}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  byId("copy").addEventListener("click", async () => {
    await navigator.clipboard.writeText(json());
    byId("status-line").textContent = "已複製 JSON";
  });
}

setupPalette();
setupToolbar();
byId("tool-help").textContent = "畫「地板」：畫筆一格一格畫，矩形拖曳填滿。";
loadOverride(areaToOverride(buildingAreas[0], world.areas));
