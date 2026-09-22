import { buildCampusMap } from "./campusMapData";
import { Player } from "./player";
import { Npc } from "./npc";
import { Camera } from "./camera";
import { InputManager } from "./input";
import { Renderer } from "./renderer";
import { DialogueBox } from "./dialogue";
import { LabelOverlay } from "./labelOverlay";
import { TimeSystem } from "./timeSystem";
import { StaminaSystem } from "./staminaSystem";

const VIEWPORT_TILES_X = 20;
const VIEWPORT_TILES_Y = 15;
const TILE_SIZE = 16;

/** 遊戲主迴圈與各系統的組裝點。Quest / Automata / Verification 尚未串接，先聚焦地圖與角色呈現。 */
export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly camera = new Camera();
  private readonly input = new InputManager();
  private readonly dialogue = new DialogueBox();
  private readonly labels = new LabelOverlay();
  private readonly map;
  private readonly player: Player;
  private readonly npcs: Npc[];

  // 目前框架版本尚未在畫面上使用，先建立實例以符合系統架構（計畫書第 18 節），供後續 Phase 串接。
  private readonly timeSystem = new TimeSystem();
  private readonly staminaSystem = new StaminaSystem();

  private lastTimestamp = 0;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEWPORT_TILES_X * TILE_SIZE;
    canvas.height = VIEWPORT_TILES_Y * TILE_SIZE;
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);

    const { map, npcSpawns } = buildCampusMap();
    this.map = map;
    this.npcs = npcSpawns.map((spawn) => new Npc(spawn));
    this.player = new Player(11, 13);

    void this.timeSystem.currentPeriod;
    void this.staminaSystem.current;
  }

  start(): void {
    requestAnimationFrame(this.loop);
  }

  private loop = (timestamp: number): void => {
    const deltaMs = this.lastTimestamp === 0 ? 0 : timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    this.update(deltaMs);
    this.renderer.draw(this.map, this.camera, this.player, this.npcs);
    this.labels.sync(this.npcs, this.camera, this.canvas);

    requestAnimationFrame(this.loop);
  };

  private update(deltaMs: number): void {
    this.player.update(deltaMs);
    for (const npc of this.npcs) npc.update(deltaMs);

    if (this.dialogue.isOpen) {
      if (this.input.consumeInteract()) {
        this.dialogue.hide();
      }
    } else {
      this.handleMovementInput();
      this.handleInteractInput();
    }

    this.camera.follow(
      this.player.pixelX,
      this.player.pixelY,
      this.renderer.viewportWidth,
      this.renderer.viewportHeight,
      this.map.width,
      this.map.height
    );
  }

  private handleMovementInput(): void {
    const direction = this.input.getHeldDirection();
    if (direction) {
      this.player.tryMove(direction, (x, y) => this.canEnterTile(x, y));
    }
  }

  /** 地圖圖塊可走，且該格沒有站著 NPC，玩家才能走進去（避免直接穿過 NPC）。 */
  private canEnterTile(x: number, y: number): boolean {
    if (!this.map.isWalkable(x, y)) return false;
    return !this.npcs.some((npc) => npc.tileX === x && npc.tileY === y);
  }

  private handleInteractInput(): void {
    if (!this.input.consumeInteract()) return;

    const target = this.player.tileInFront();
    const npc = this.npcs.find(
      (candidate) => candidate.tileX === target.x && candidate.tileY === target.y
    );
    if (npc && npc.isPresent) {
      this.dialogue.show(`${npc.name}（${npc.locationLabel}）`, npc.greeting);
    }
  }
}
