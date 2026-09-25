import { MAIN_GATE_SPAWN, OUTDOOR_AREA_ID, buildCampusWorld } from "./campusMapData";
import {
  floorAreaId,
  floorLabel,
  isInsideRoom,
  type Area,
  type RoomRegion,
  type Warp,
} from "./area";
import { TileType } from "./tileTypes";
import { Player } from "./player";
import { PLAYER_MOVE_DURATION_MS } from "./entity";
import type { Direction } from "./pixelSprite";
import { Npc } from "./npc";
import { Camera } from "./camera";
import { InputManager } from "./input";
import { isNpcWalkableTile } from "./npcWalkable";
import { Renderer } from "./renderer";
import { DialogueBox } from "./dialogue";
import { LabelOverlay, tileLabelAnchor, type OverlayLabel } from "./labelOverlay";
import { TimeSystem, formatClock } from "./timeSystem";
import { StaminaSystem } from "./staminaSystem";
import {
  VERTICAL_MODE_LABELS,
  computeVerticalTravelCost,
  floorsBetween,
  type VerticalMode,
} from "./verticalTravel";
import {
  QuestManager,
  buildAutomatonForQuest,
  buildNfaForQuest,
  type QuestDefinition,
  type PresenceGatedNpcEvent,
} from "../quest/questManager";
import questData from "../quest/questData.json";
import { Verifier } from "../verification/verifier";
import { QuestPanel } from "../ui/questPanel";
import { VerificationPanel } from "../ui/verificationPanel";
import { StatusBar } from "../ui/statusBar";
import { FloorMenu, type FloorOption } from "../ui/floorMenu";
import { AutomatonViewer, type AutomatonViewerInput } from "../ui/automatonViewer";

const VIEWPORT_TILES_X = 20;
const VIEWPORT_TILES_Y = 15;
const TILE_SIZE = 16;

/** 時間流逝速度：真實時間每 1 秒，遊戲內過 1 分鐘（一天 8:00～20:00 約 12 分鐘）。 */
const GAME_MINUTES_PER_REAL_SECOND = 1;

/** 體力消耗量（計畫書 9.5 節：移動、等待、碰運氣皆會消耗體力）。換樓層的成本見 verticalTravel.ts。 */
const MOVE_STAMINA_COST = 0.25;
/** 按住 Shift 跑步：走一格的時間縮短，但每格消耗的體力是走路的 3 倍。 */
const RUN_STAMINA_COST = 0.75;
const RUN_MOVE_DURATION_MS = 90;
const ADVANCE_TIME_STAMINA_COST = 15;
const PROBE_ABSENT_NPC_STAMINA_COST = 5;

/** 臨時任務（體力耗盡去吃飯休息）與餐廳用餐花掉的時間（分鐘）。 */
const REST_TASK_MINUTES = 60;
const MEAL_MINUTES = 30;
/** 1F 大廳休息區：坐一下補一部分體力。 */
const BENCH_REST_MINUTES = 15;
const BENCH_REST_STAMINA = 30;
/** 影印中心 / 成績單列印機印一份文件花的時間。 */
const PRINT_MINUTES = 5;

interface QuestRuntime {
  quest: QuestDefinition;
  verifier: Verifier;
}

/**
 * 遊戲主迴圈與各系統的組裝點：地圖 / 角色呈現，加上 Quest → Event → Verification Engine 的串接，
 * 以及時間 / 體力系統對 NPC 出現與臨時任務的影響（計畫書第 9 節）。
 *
 * 校園分成多個區域（戶外校園 + 各建築物的每一層），玩家同一時間只在一個區域裡；
 * 走進建築物大門會進到 1F，面對樓梯或電梯按互動鍵可以換樓層。
 * 時間會隨真實時間持續流逝，每天晚上 8:00 閉校，玩家會被送回正門口、時間回到隔天早上 8:00。
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
  private readonly floorMenu = new FloorMenu();
  private readonly automatonViewer = new AutomatonViewer();
  private readonly areas: Map<string, Area>;
  private currentArea: Area;
  private readonly player: Player;
  private readonly npcs: Npc[];

  private readonly quests: QuestRuntime[];
  private activeQuestIndex = 0;

  private readonly timeSystem = new TimeSystem();
  private readonly staminaSystem = new StaminaSystem();
  /** 互動對話顯示中若把體力耗盡，臨時任務要等玩家關掉目前對話框才觸發，避免疊兩個對話框。 */
  private restTaskPending = false;
  /** 玩家剛踏上的傳送點（建築物大門 / 出口），等走路動畫結束才真的換區域。 */
  private pendingWarp: Warp | null = null;
  /** 樓層選單目前是樓梯還是電梯開的。 */
  private verticalMode: VerticalMode = "stairs";
  /** 走樓梯時是哪一座樓梯（到別層後從同一座出來）。 */
  private staircaseIndex = 0;
  /**
   * 手上印好的文件（申請單、成績單）與份數。道具本身只是 Game Layer 的顯示；
   * 真正決定流程合不合法的是送進 Verifier 的列印事件（文件 D）。
   */
  private readonly inventory = new Map<string, number>();

  private lastTimestamp = 0;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEWPORT_TILES_X * TILE_SIZE;
    canvas.height = VIEWPORT_TILES_Y * TILE_SIZE;
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);

    const { areas, npcSpawns } = buildCampusWorld();
    this.areas = areas;
    this.currentArea = this.getArea(MAIN_GATE_SPAWN.areaId);
    this.npcs = npcSpawns.map((spawn) => new Npc(spawn));
    this.refreshNpcPresence();
    this.player = new Player(MAIN_GATE_SPAWN.x, MAIN_GATE_SPAWN.y);
    this.player.direction = MAIN_GATE_SPAWN.direction;

    const questManager = new QuestManager();
    questManager.loadFrom(questData as unknown as QuestDefinition[]);
    this.quests = questManager.getQuests().map((quest) => ({
      quest,
      verifier: new Verifier(buildAutomatonForQuest(quest)),
    }));
    if (this.quests.length === 0) throw new Error("questData.json 裡沒有任何 quest 定義");

    this.automatonViewer.onOpenRequested(() => this.openAutomatonViewer());
    this.floorMenu.onChoose((floor) => this.travelToFloor(floor));

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
    const npcsHere = this.npcsInCurrentArea();
    const rooms = this.splitRoomsByVisibility();
    this.renderer.draw(this.currentArea.map, this.camera, this.player, npcsHere, rooms);
    this.labels.sync(this.buildOverlayLabels(npcsHere, rooms.hidden), this.camera, this.canvas);

    requestAnimationFrame(this.loop);
  };

  private update(deltaMs: number): void {
    this.player.update(deltaMs);
    for (const npc of this.npcs) npc.update(deltaMs);

    if (this.automatonViewer.isOpen) {
      if (this.input.consumeToggleAutomaton() || this.input.consumeCancel()) {
        this.automatonViewer.close();
      }
    } else if (this.floorMenu.isOpen) {
      this.handleFloorMenuInput();
    } else if (this.dialogue.isOpen) {
      if (this.input.consumeInteract()) {
        this.dialogue.hide();
        if (this.restTaskPending) {
          this.restTaskPending = false;
          this.triggerRestTask();
        }
      }
    } else {
      // 對話框、選單、Automaton 視窗開著的時候時間暫停，只有玩家能自由行動時才會流逝。
      this.passTime((deltaMs / 1000) * GAME_MINUTES_PER_REAL_SECOND);
      if (this.timeSystem.isCurfew) {
        this.triggerCurfew();
      } else {
        this.applyPendingWarp();
        this.updateRoamingNpcs(deltaMs);
        this.handleMovementInput();
        this.handleInteractInput();
        this.handleCycleQuestInput();
        this.handleAdvanceTimeInput();
        this.handleToggleAutomatonInput();
      }
    }
    // 一次性的方向鍵事件只給樓層選單用，其他狀態下直接丟掉，避免開選單時讀到很久以前的按鍵。
    if (!this.floorMenu.isOpen) this.input.clearDirectionPresses();

    this.renderStatusBar();
    this.camera.follow(
      this.player.pixelX,
      this.player.pixelY,
      this.renderer.viewportWidth,
      this.renderer.viewportHeight,
      this.currentArea.map.width,
      this.currentArea.map.height
    );
  }

  private handleMovementInput(): void {
    const direction = this.input.getHeldDirection();
    if (!direction) return;

    const running = this.input.isRunHeld();
    if (!this.player.isMoving) {
      this.player.moveDurationMs = running ? RUN_MOVE_DURATION_MS : PLAYER_MOVE_DURATION_MS;
    }
    const moved = this.player.tryMove(direction, (x, y) => this.canEnterTile(x, y));
    if (!moved) return;

    this.pendingWarp = this.findWarpAt(this.player.tileX, this.player.tileY);
    this.staminaSystem.consume(running ? RUN_STAMINA_COST : MOVE_STAMINA_COST);
    if (this.staminaSystem.isDepleted) this.triggerRestTask();
  }

  /** 地圖圖塊可走，且該格沒有站著 NPC，玩家才能走進去（避免直接穿過 NPC）。 */
  private canEnterTile(x: number, y: number): boolean {
    if (!this.currentArea.map.isWalkable(x, y)) return false;
    return !this.npcsInCurrentArea().some((npc) => npc.occupies(x, y));
  }

  /** 同一個區域裡會走動的 NPC 才需要更新；其他區域的 NPC 玩家看不到，停在原地即可。 */
  private updateRoamingNpcs(deltaMs: number): void {
    const canWalk = (x: number, y: number) => isNpcWalkableTile(this.currentArea, x, y);
    for (const npc of this.npcsInCurrentArea()) {
      if (!npc.roams) continue;
      npc.updateRoaming(deltaMs, canWalk, (x, y) => canWalk(x, y) && !this.isTileOccupied(x, y, npc));
    }
  }

  /** 這一格現在有沒有其他角色（玩家或同區域的其他 NPC，包含不在場 NPC 留下的空位）。 */
  private isTileOccupied(x: number, y: number, except: Npc): boolean {
    if (this.player.tileX === x && this.player.tileY === y) return true;
    return this.npcsInCurrentArea().some(
      (npc) => npc !== except && npc.occupies(x, y)
    );
  }

  private findWarpAt(x: number, y: number): Warp | null {
    return this.currentArea.warps.find((warp) => warp.x === x && warp.y === y) ?? null;
  }

  /** 走上建築物大門 / 出口的那一步動畫播完之後，才真的切換到另一個區域。 */
  private applyPendingWarp(): void {
    if (!this.pendingWarp || this.player.isMoving) return;
    const warp = this.pendingWarp;
    this.pendingWarp = null;
    this.moveToArea(warp.toAreaId, warp.toX, warp.toY, warp.direction);
  }

  private moveToArea(areaId: string, x: number, y: number, direction: Player["direction"]): void {
    this.currentArea = this.getArea(areaId);
    this.player.placeAt(x, y, direction);
  }

  private handleCycleQuestInput(): void {
    if (!this.input.consumeCycleQuest() || this.quests.length <= 1) return;
    this.activeQuestIndex = (this.activeQuestIndex + 1) % this.quests.length;
    this.renderPanels();
  }

  /** 跳轉時間（計畫書 9.4 節）：直接快轉到下一個時段的開頭（晚上再跳就是閉校），本身也會消耗體力。 */
  private handleAdvanceTimeInput(): void {
    if (!this.input.consumeAdvanceTime()) return;

    this.staminaSystem.consume(ADVANCE_TIME_STAMINA_COST);
    this.timeSystem.advanceToNextPeriod();
    this.refreshNpcPresence();
    if (this.timeSystem.isCurfew) {
      this.triggerCurfew();
      return;
    }
    if (this.staminaSystem.isDepleted) this.triggerRestTask();
  }

  /** 顯示 / 關閉 Automaton 視窗（計畫書第 16 節），不消耗體力也不影響 Trace，純粹是檢視用途。 */
  private handleToggleAutomatonInput(): void {
    if (!this.input.consumeToggleAutomaton()) return;
    this.openAutomatonViewer();
  }

  private openAutomatonViewer(): void {
    this.automatonViewer.open(this.buildAutomatonViewerInput());
  }

  private buildAutomatonViewerInput(): AutomatonViewerInput {
    const { quest, verifier } = this.activeQuestRuntime();
    return { quest, verifier, dfa: verifier.getAutomaton(), nfa: buildNfaForQuest(quest) };
  }

  /** 讓遊戲內時間往前走；跨越時段時重新計算所有 NPC 是否在場。 */
  private passTime(minutes: number): void {
    if (this.timeSystem.advanceMinutes(minutes)) this.refreshNpcPresence();
  }

  private refreshNpcPresence(): void {
    for (const npc of this.npcs) npc.refreshPresence(this.timeSystem.currentPeriod);
  }

  private handleInteractInput(): void {
    if (!this.input.consumeInteract()) return;

    const target = this.player.tileInFront();
    const tile = this.currentArea.map.getTile(target.x, target.y);
    if (tile === TileType.Stairs || tile === TileType.Elevator) {
      if (tile === TileType.Stairs) {
        const stairs = this.currentArea.building?.anchors.stairs ?? [];
        this.staircaseIndex = Math.max(
          0,
          stairs.findIndex((staircase) =>
            staircase.tiles.some((t) => t.x === target.x && t.y === target.y)
          )
        );
      }
      this.openFloorMenu(tile === TileType.Stairs ? "stairs" : "elevator");
      return;
    }
    if (tile === TileType.Bench) {
      this.restOnBench();
      return;
    }

    const npc = this.findNpcToTalkTo(target);
    if (!npc) return;
    npc.faceTowardsSpeaker(this.player.direction);

    if (npc.service === "meal" && npc.isPresent) {
      this.eatMeal(npc);
      return;
    }
    if (npc.service === "print" && npc.isPresent) {
      this.printDocument(npc);
      return;
    }

    if (!npc.isPresent) {
      this.staminaSystem.consume(PROBE_ABSENT_NPC_STAMINA_COST);
    }

    // 人不在的時候，對話框標題是那個地點（空位），不是 NPC 本人在講話。
    const speaker = npc.isPresent ? `${npc.name}（${npc.locationLabel}）` : npc.locationLabel;
    this.dialogue.show(speaker, this.resolveDialogueFor(npc));
    this.renderPanels();
    if (this.staminaSystem.isDepleted) this.restTaskPending = true;
  }

  /**
   * 找要說話的 NPC：先看正前方；前面沒人的話，只要旁邊（上下左右）有碰到的 NPC 也可以說話，
   * 玩家會自動轉向他。走動中的 NPC 同時佔著出發格和目的格，碰到哪一格都算。
   */
  private findNpcToTalkTo(front: { x: number; y: number }): Npc | undefined {
    const here = this.npcsInCurrentArea();
    const ahead = here.find((npc) => npc.occupies(front.x, front.y));
    if (ahead) return ahead;

    const { tileX, tileY } = this.player;
    const neighbours: Array<{ dx: number; dy: number; direction: Direction }> = [
      { dx: 0, dy: -1, direction: "up" },
      { dx: 0, dy: 1, direction: "down" },
      { dx: -1, dy: 0, direction: "left" },
      { dx: 1, dy: 0, direction: "right" },
    ];
    for (const { dx, dy, direction } of neighbours) {
      const npc = here.find((candidate) => candidate.occupies(tileX + dx, tileY + dy));
      if (npc) {
        this.player.faceTowards(direction);
        return npc;
      }
    }
    return undefined;
  }

  /** 餐廳吃飯：花一點時間把體力補滿。純遊戲層行為，不會送任何事件進 Verification Engine。 */
  private eatMeal(npc: Npc): void {
    this.staminaSystem.restore(this.staminaSystem.max);
    this.passTime(MEAL_MINUTES);
    this.dialogue.show(
      `${npc.name}（${npc.locationLabel}）`,
      `${npc.greeting}\n吃飽了，體力回滿（花了 ${MEAL_MINUTES} 分鐘）。`
    );
  }

  /** 1F 大廳休息區：坐下來休息一下，補回一部分體力。純遊戲層行為，不進 Trace。 */
  private restOnBench(): void {
    this.staminaSystem.restore(BENCH_REST_STAMINA);
    this.passTime(BENCH_REST_MINUTES);
    this.dialogue.show(
      "休息區",
      `在大廳沙發坐了一下，體力恢復 ${BENCH_REST_STAMINA}（花了 ${BENCH_REST_MINUTES} 分鐘）。`
    );
  }

  /** 影印中心：印一份申請表。目前只是遊戲層的道具，不會送任何事件進 Verification Engine。 */
  /**
   * 印文件：手上多一份申請單或成績單，並花一點時間。
   * 如果目前作用中的任務（文件 D）把這台機器 / 這位店員對應到列印事件，就同時送進 Verifier，
   * 例如還沒印申請單就先印兩次成績單，第二次會因為沒有對應 transition 而 REJECT。
   */
  private printDocument(npc: Npc): void {
    const item = npc.printItem ?? "申請單";
    this.inventory.set(item, (this.inventory.get(item) ?? 0) + 1);
    this.passTime(PRINT_MINUTES);
    const printed = `印好一份${item}（花了 ${PRINT_MINUTES} 分鐘），手上共有 ${this.inventory.get(item)} 份。`;

    const { quest } = this.activeQuestRuntime();
    const text = quest.npcEvents[npc.id]
      ? `${printed}\n${this.resolveDialogueFor(npc)}`
      : `${npc.greeting}\n${printed}`;
    this.dialogue.show(`${npc.name}（${npc.locationLabel}）`, text);
    this.renderPanels();
  }

  /**
   * 目前這一層哪些房間要蓋起來：玩家站在房門口或在房間裡，那間就看得到；
   * 其他房間門關著，從走廊看不到裡面有誰，要走進去才知道（例如老師在不在）。
   */
  private splitRoomsByVisibility(): { visible: RoomRegion[]; hidden: RoomRegion[] } {
    const { tileX, tileY } = this.player;
    const visible: RoomRegion[] = [];
    const hidden: RoomRegion[] = [];
    for (const room of this.currentArea.rooms) {
      const open =
        isInsideRoom(room, tileX, tileY) || (room.doorX === tileX && room.doorY === tileY);
      (open ? visible : hidden).push(room);
    }
    return { visible, hidden };
  }

  /** 面對樓梯或電梯按互動鍵：列出這棟建築物其他樓層，以及各自要花的體力與時間。 */
  private openFloorMenu(mode: VerticalMode): void {
    const building = this.currentArea.building;
    if (!building) return;

    this.verticalMode = mode;
    const options: FloorOption[] = [];
    for (const floor of building.floors) {
      if (floor === building.floor) continue;
      const cost = computeVerticalTravelCost(mode, building.floor, floor);
      const count = floorsBetween(building.floor, floor);
      const direction = floor > building.floor ? `上 ${count} 層` : `下 ${count} 層`;
      options.push({
        floor,
        label: floorLabel(floor),
        detail: `${direction}，體力 −${cost.stamina}，約 ${cost.minutes} 分鐘`,
      });
    }
    // 預設選在「往上一層」，已經在頂樓的話就選「往下一層」（floors 由高到低排列）。
    const currentIndex = building.floors.indexOf(building.floor);
    const above = building.floors[currentIndex - 1];
    const below = building.floors[currentIndex + 1];
    const preferred = options.findIndex((option) => option.floor === above);
    const fallback = options.findIndex((option) => option.floor === below);
    this.floorMenu.open(
      `${building.buildingName} ${floorLabel(building.floor)}：${mode === "stairs" ? "走" : "搭"}${VERTICAL_MODE_LABELS[mode]}到哪一層？`,
      options,
      preferred >= 0 ? preferred : Math.max(0, fallback)
    );
  }

  private handleFloorMenuInput(): void {
    if (this.input.consumeCancel()) {
      this.floorMenu.close();
      return;
    }
    let direction = this.input.consumeDirectionPress();
    while (direction) {
      if (direction === "up") this.floorMenu.moveSelection(-1);
      if (direction === "down") this.floorMenu.moveSelection(1);
      direction = this.input.consumeDirectionPress();
    }
    if (this.input.consumeInteract()) this.floorMenu.confirm();
  }

  /** 真的換樓層：扣體力、過時間，玩家出現在目標樓層的樓梯口 / 電梯口。 */
  private travelToFloor(floor: number): void {
    const building = this.currentArea.building;
    if (!building) return;

    const cost = computeVerticalTravelCost(this.verticalMode, building.floor, floor);
    this.staminaSystem.consume(cost.stamina);
    this.passTime(cost.minutes);

    const arrival =
      this.verticalMode === "stairs"
        ? building.anchors.stairs[this.staircaseIndex].arrival
        : building.anchors.elevatorArrival;
    this.moveToArea(floorAreaId(building.buildingId, floor), arrival.x, arrival.y, arrival.direction);
    if (this.staminaSystem.isDepleted) this.triggerRestTask();
  }

  /** 這個 NPC 若在目前作用中任務裡有對應事件，就送進 Verification Engine；否則只是單純問候或撲空提示。 */
  private resolveDialogueFor(npc: Npc): string {
    const { quest, verifier } = this.activeQuestRuntime();
    const npcEvent = quest.npcEvents[npc.id];
    if (!npcEvent) {
      return npc.isPresent ? npc.nextSmallTalk() : `座位上沒有人，${npc.name}現在不在。`;
    }

    const event = this.resolveVisitEvent(npcEvent, npc);
    if (!event) {
      return `座位上沒有人，${npc.name}現在不在，要不要晚點再來看看？`;
    }

    const outcome = verifier.handleEvent(event);
    if (!outcome.isValid) {
      // 撲空（NPC 不在場）沒有對應 transition，一定會落在這裡：不需要 Waiting State，
      // 沿用「未定義 transition → REJECT」的預設行為即可，但顯示給玩家的文字要跟「走錯
      // 流程」的 REJECT 分開，避免讓人誤以為單純去確認老師在不在也算操作失誤。
      if (typeof npcEvent !== "string" && event === npcEvent.absent) {
        return `座位上沒有人，${npc.name}不在，撲空了。要不要先跳轉時間，晚點再來看看？`;
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
    this.passTime(REST_TASK_MINUTES);
    this.dialogue.show(
      "臨時任務",
      `體力耗盡，先去吃飯休息...\n（體力恢復、時間過了 ${REST_TASK_MINUTES} 分鐘，這段不會算進申請流程的 Trace）`
    );
  }

  /**
   * 晚上 8:00 閉校：不論玩家在哪一棟、哪一層，都送回正門口，時間回到隔天早上 8:00、體力回滿。
   * 跟臨時任務一樣是純遊戲層事件，各任務的 Verifier 狀態與 Trace 都保留，不會被重置。
   */
  private triggerCurfew(): void {
    this.timeSystem.startNextDay();
    this.staminaSystem.restore(this.staminaSystem.max);
    this.refreshNpcPresence();
    this.pendingWarp = null;
    this.restTaskPending = false;
    this.floorMenu.close();
    this.moveToArea(MAIN_GATE_SPAWN.areaId, MAIN_GATE_SPAWN.x, MAIN_GATE_SPAWN.y, MAIN_GATE_SPAWN.direction);
    this.dialogue.show(
      "正門警衛（晚上 8:00 閉校）",
      `同學，校園要關門了，請先離開喔。\n第 ${this.timeSystem.day} 天 ${formatClock(this.timeSystem.minutesOfDay)}，你又回到正門口（忠孝東路）。申請進度與 Trace 都還在。`
    );
  }

  private getArea(areaId: string): Area {
    const area = this.areas.get(areaId);
    if (!area) throw new Error(`找不到區域 ${areaId}`);
    return area;
  }

  private npcsInCurrentArea(): Npc[] {
    return this.npcs.filter((npc) => npc.areaId === this.currentArea.id);
  }

  private buildOverlayLabels(npcsHere: Npc[], hiddenRooms: RoomRegion[]): OverlayLabel[] {
    const places: OverlayLabel[] = this.currentArea.labels.map((label, index) => ({
      key: `${this.currentArea.id}:place:${index}`,
      text: label.text,
      variant: "place",
      ...tileLabelAnchor(label.x, label.y),
    }));
    // 不在場的 NPC 不顯示名字，只留空椅子；門關著的房間裡的人也看不到名字。
    const visiblePeople = npcsHere.filter(
      (npc) => npc.isPresent && !hiddenRooms.some((room) => isInsideRoom(room, npc.tileX, npc.tileY))
    );
    const people: OverlayLabel[] = visiblePeople.map((npc) => ({
      key: `npc:${npc.id}`,
      text: npc.name,
      variant: "npc",
      pixelX: npc.pixelX + TILE_SIZE / 2,
      pixelY: npc.pixelY,
    }));
    return [...places, ...people];
  }

  private activeQuestRuntime(): QuestRuntime {
    return this.quests[this.activeQuestIndex];
  }

  private renderPanels(): void {
    const { quest, verifier } = this.activeQuestRuntime();
    this.questPanel.render(
      quest,
      verifier,
      this.activeQuestIndex,
      this.quests.length,
      this.buildStepLocations(quest)
    );
    this.verificationPanel.render(verifier, quest);
    this.automatonViewer.update(this.buildAutomatonViewerInput());
  }

  /**
   * 任務步驟 → 要去哪個辦公室。只給固定的辦公室位置（NPC 的 locationLabel），
   * 不追蹤 NPC 當下在不在、也不追蹤會走動的 NPC 走到哪。
   */
  private buildStepLocations(quest: QuestDefinition): Record<string, string[]> {
    const locations: Record<string, string[]> = {};
    for (const [npcId, npcEvent] of Object.entries(quest.npcEvents)) {
      const npc = this.npcs.find((candidate) => candidate.id === npcId);
      if (!npc) continue;
      const event = typeof npcEvent === "string" ? npcEvent : npcEvent.present;
      // 同一件事可以在好幾個地方做（例如成績單有三台列印機），全部列出來
      (locations[event] ??= []).push(npc.locationLabel);
    }
    return locations;
  }

  private renderStatusBar(): void {
    this.statusBar.render({
      day: this.timeSystem.day,
      minutesOfDay: this.timeSystem.minutesOfDay,
      period: this.timeSystem.currentPeriod,
      stamina: this.staminaSystem.current,
      maxStamina: this.staminaSystem.max,
      location: this.currentArea.id === OUTDOOR_AREA_ID ? "校園" : this.currentArea.name,
      items: [...this.inventory].map(([item, count]) => `${item} ${count} 份`).join("、"),
    });
  }
}
