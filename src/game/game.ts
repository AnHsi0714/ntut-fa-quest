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
import {
  QuestManager,
  buildAutomatonForQuest,
  type QuestDefinition,
  type PresenceGatedNpcEvent,
} from "../quest/questManager";
import questData from "../quest/questData.json";
import { Verifier } from "../verification/verifier";
import { QuestPanel } from "../ui/questPanel";
import { VerificationPanel } from "../ui/verificationPanel";
import { StatusBar } from "../ui/statusBar";

const VIEWPORT_TILES_X = 20;
const VIEWPORT_TILES_Y = 15;
const TILE_SIZE = 16;

/** 體力消耗量（計畫書 9.5 節：移動、等待、碰運氣皆會消耗體力）。 */
const MOVE_STAMINA_COST = 1;
const ADVANCE_TIME_STAMINA_COST = 15;
const PROBE_ABSENT_NPC_STAMINA_COST = 5;

interface QuestRuntime {
  quest: QuestDefinition;
  verifier: Verifier;
}

/**
 * 遊戲主迴圈與各系統的組裝點：地圖 / 角色呈現，加上 Quest → Event → Verification Engine 的串接，
 * 以及時間 / 體力系統對 NPC 出現與臨時任務的影響（計畫書第 9 節）。
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
  private readonly statusBar = new StatusBar();
  private readonly map;
  private readonly player: Player;
  private readonly npcs: Npc[];

  private readonly quests: QuestRuntime[];
  private activeQuestIndex = 0;

  private readonly timeSystem = new TimeSystem();
  private readonly staminaSystem = new StaminaSystem();
  /** 互動對話顯示中若把體力耗盡，臨時任務要等玩家關掉目前對話框才觸發，避免疊兩個對話框。 */
  private restTaskPending = false;

  private lastTimestamp = 0;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEWPORT_TILES_X * TILE_SIZE;
    canvas.height = VIEWPORT_TILES_Y * TILE_SIZE;
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);

    const { map, npcSpawns } = buildCampusMap();
    this.map = map;
    this.npcs = npcSpawns.map((spawn) => new Npc(spawn));
    this.refreshNpcPresence();
    this.player = new Player(11, 13);

    const questManager = new QuestManager();
    questManager.loadFrom(questData as unknown as QuestDefinition[]);
    this.quests = questManager.getQuests().map((quest) => ({
      quest,
      verifier: new Verifier(buildAutomatonForQuest(quest)),
    }));
    if (this.quests.length === 0) throw new Error("questData.json 裡沒有任何 quest 定義");

    this.renderPanels();
    this.renderStatusBar();
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
        if (this.restTaskPending) {
          this.restTaskPending = false;
          this.triggerRestTask();
        }
      }
    } else {
      this.handleMovementInput();
      this.handleInteractInput();
      this.handleCycleQuestInput();
      this.handleAdvanceTimeInput();
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
    if (!direction) return;

    const moved = this.player.tryMove(direction, (x, y) => this.canEnterTile(x, y));
    if (!moved) return;

    this.staminaSystem.consume(MOVE_STAMINA_COST);
    this.renderStatusBar();
    if (this.staminaSystem.isDepleted) this.triggerRestTask();
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

  /** 跳轉時間（計畫書 9.4 節）：切到下一個時段，重新計算所有 NPC 是否在場，本身也會消耗體力。 */
  private handleAdvanceTimeInput(): void {
    if (!this.input.consumeAdvanceTime()) return;

    this.staminaSystem.consume(ADVANCE_TIME_STAMINA_COST);
    this.timeSystem.advanceToNextPeriod();
    this.refreshNpcPresence();
    this.renderStatusBar();
    if (this.staminaSystem.isDepleted) this.triggerRestTask();
  }

  private refreshNpcPresence(): void {
    for (const npc of this.npcs) npc.refreshPresence(this.timeSystem.currentPeriod);
  }

  private handleInteractInput(): void {
    if (!this.input.consumeInteract()) return;

    const target = this.player.tileInFront();
    const npc = this.npcs.find(
      (candidate) => candidate.tileX === target.x && candidate.tileY === target.y
    );
    if (!npc) return;

    if (!npc.isPresent) {
      this.staminaSystem.consume(PROBE_ABSENT_NPC_STAMINA_COST);
    }

    this.dialogue.show(`${npc.name}（${npc.locationLabel}）`, this.resolveDialogueFor(npc));
    this.renderPanels();
    this.renderStatusBar();
    if (this.staminaSystem.isDepleted) this.restTaskPending = true;
  }

  /** 這個 NPC 若在目前作用中任務裡有對應事件，就送進 Verification Engine；否則只是單純問候或撲空提示。 */
  private resolveDialogueFor(npc: Npc): string {
    const { quest, verifier } = this.activeQuestRuntime();
    const npcEvent = quest.npcEvents[npc.id];
    if (!npcEvent) {
      return npc.isPresent ? npc.greeting : `${npc.name}現在不在（${npc.locationLabel}）。`;
    }

    const event = this.resolveVisitEvent(npcEvent, npc);
    if (!event) {
      return `${npc.name}現在不在（${npc.locationLabel}），要不要晚點再來看看？`;
    }

    const outcome = verifier.handleEvent(event);
    if (!outcome.isValid) {
      // 撲空（NPC 不在場）沒有對應 transition，一定會落在這裡：不需要 Waiting State，
      // 沿用「未定義 transition → REJECT」的預設行為即可，但顯示給玩家的文字要跟「走錯
      // 流程」的 REJECT 分開，避免讓人誤以為單純去確認老師在不在也算操作失誤。
      if (typeof npcEvent !== "string" && event === npcEvent.absent) {
        return `${npc.name}不在${npc.locationLabel}，撲空了。要不要先跳轉時間，晚點再來看看？`;
      }

      const expected = outcome.counterexample?.expectedEvents ?? [];
      const expectedLabels = expected.map((e) => quest.eventLabels[e] ?? e);
      const hint =
        expectedLabels.length > 0
          ? `目前流程還沒輪到這一步。下一步：${expectedLabels.join(" 或 ")}。`
          : "這個流程已經走完了，沒有下一步了。";
      return `REJECT（Invalid Transition）\n${hint}`;
    }

    if (verifier.isAccepted()) {
      return `${npc.greeting}\nACCEPT！${quest.name} 申請流程完成。`;
    }
    return npc.greeting;
  }

  /**
   * 依 NPC 是否在場決定這次互動要送進 Verification Engine 的事件；時間 / 機率只在這裡
   * 影響「要送哪個 Event」，Verifier 本身完全不需要知道（計畫書 9.2 節）。
   */
  private resolveVisitEvent(npcEvent: string | PresenceGatedNpcEvent, npc: Npc): string | undefined {
    if (typeof npcEvent === "string") {
      return npc.isPresent ? npcEvent : undefined;
    }
    return npc.isPresent ? npcEvent.present : npcEvent.absent;
  }

  /** 體力歸零觸發的臨時任務（計畫書 9.5 節）：純遊戲層事件，不會呼叫 Verifier、不會進 Trace。 */
  private triggerRestTask(): void {
    this.staminaSystem.restore(this.staminaSystem.max);
    this.timeSystem.advanceToNextPeriod();
    this.refreshNpcPresence();
    this.dialogue.show(
      "臨時任務",
      "體力耗盡，先去吃飯...\n（體力恢復、時間推進到下一個時段，這段不會算進申請流程的 Trace）"
    );
    this.renderStatusBar();
  }

  private activeQuestRuntime(): QuestRuntime {
    return this.quests[this.activeQuestIndex];
  }

  private renderPanels(): void {
    const { quest, verifier } = this.activeQuestRuntime();
    this.questPanel.render(quest, verifier, this.activeQuestIndex, this.quests.length);
    this.verificationPanel.render(verifier, quest);
  }

  private renderStatusBar(): void {
    this.statusBar.render(this.timeSystem.currentPeriod, this.staminaSystem.current, this.staminaSystem.max);
  }
}
