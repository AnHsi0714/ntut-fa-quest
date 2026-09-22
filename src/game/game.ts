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
import { QuestManager, buildAutomatonForQuest, type QuestDefinition } from "../quest/questManager";
import questData from "../quest/questData.json";
import { Verifier } from "../verification/verifier";
import { QuestPanel } from "../ui/questPanel";
import { VerificationPanel } from "../ui/verificationPanel";

const VIEWPORT_TILES_X = 20;
const VIEWPORT_TILES_Y = 15;
const TILE_SIZE = 16;

interface QuestRuntime {
  quest: QuestDefinition;
  verifier: Verifier;
}

/**
 * 遊戲主迴圈與各系統的組裝點：地圖 / 角色呈現，加上 Quest → Event → Verification Engine 的串接。
 *
 * 一次只有一個任務「作用中」（按 Q 切換）：互動時只會檢查目前作用中任務的 npcEvents，
 * 但每個任務各自保留自己的 Verifier，切換回去進度還在，不會被重置。
 */
export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly camera = new Camera();
  private readonly input = new InputManager();
  private readonly dialogue = new DialogueBox();
  private readonly labels = new LabelOverlay();
  private readonly questPanel = new QuestPanel();
  private readonly verificationPanel = new VerificationPanel();
  private readonly map;
  private readonly player: Player;
  private readonly npcs: Npc[];

  private readonly quests: QuestRuntime[];
  private activeQuestIndex = 0;

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

    const questManager = new QuestManager();
    questManager.loadFrom(questData as unknown as QuestDefinition[]);
    this.quests = questManager.getQuests().map((quest) => ({
      quest,
      verifier: new Verifier(buildAutomatonForQuest(quest)),
    }));
    if (this.quests.length === 0) throw new Error("questData.json 裡沒有任何 quest 定義");

    this.renderPanels();

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
      this.handleCycleQuestInput();
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

  private handleCycleQuestInput(): void {
    if (!this.input.consumeCycleQuest() || this.quests.length <= 1) return;
    this.activeQuestIndex = (this.activeQuestIndex + 1) % this.quests.length;
    this.renderPanels();
  }

  private handleInteractInput(): void {
    if (!this.input.consumeInteract()) return;

    const target = this.player.tileInFront();
    const npc = this.npcs.find(
      (candidate) => candidate.tileX === target.x && candidate.tileY === target.y
    );
    if (!npc || !npc.isPresent) return;

    this.dialogue.show(`${npc.name}（${npc.locationLabel}）`, this.resolveDialogueFor(npc));
    this.renderPanels();
  }

  /** 這個 NPC 若在目前作用中任務裡有對應事件，就送進 Verification Engine；否則只是單純問候。 */
  private resolveDialogueFor(npc: Npc): string {
    const { quest, verifier } = this.activeQuestRuntime();
    const event = quest.npcEvents[npc.id];
    if (!event) {
      return npc.greeting;
    }

    const outcome = verifier.handleEvent(event);
    if (!outcome.isValid) {
      const expected = outcome.counterexample?.expectedEvents ?? [];
      const expectedLabels = expected.map((e) => quest.eventLabels[e] ?? e);
      const hint =
        expectedLabels.length > 0
          ? `目前流程還沒輪到這一步。下一步可以是：${expectedLabels.join(" 或 ")}。`
          : "這個流程已經走完了，沒有下一步了。";
      return `REJECT（Invalid Transition）\n${hint}`;
    }

    if (verifier.isAccepted()) {
      return `${npc.greeting}\nACCEPT！${quest.name} 申請流程完成。`;
    }
    return npc.greeting;
  }

  private activeQuestRuntime(): QuestRuntime {
    return this.quests[this.activeQuestIndex];
  }

  private renderPanels(): void {
    const { quest, verifier } = this.activeQuestRuntime();
    this.questPanel.render(quest, verifier, this.activeQuestIndex, this.quests.length);
    this.verificationPanel.render(verifier, quest);
  }
}
