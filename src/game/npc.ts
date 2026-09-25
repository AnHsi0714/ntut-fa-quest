import { Entity } from "./entity";
import { buildCharacterSpriteSet, buildKioskSpriteSet, NPC_PALETTES, PLAYER_PALETTE } from "./pixelSprite";
import type { NpcSpawn } from "./campusMapData";
import type { TimePeriod } from "./timeSystem";
import type { Direction } from "./pixelSprite";
import { findPath, type TilePoint } from "./pathfinding";

/** 走動型 NPC 走一格的時間（毫秒），比玩家的 160ms 慢，玩家追得上。 */
const WALKER_MOVE_DURATION_MS = 300;
/** 走到目的地後停留的時間範圍（毫秒），像是在那邊辦事、聊天。 */
const ARRIVAL_PAUSE_MIN_MS = 2000;
const ARRIVAL_PAUSE_MAX_MS = 5000;
/** 被其他角色擋住超過這麼久，就放棄這條路，停一下再重新找路。 */
const BLOCKED_GIVE_UP_MS = 1500;
/** 被玩家搭話時停下來的時間（毫秒）。 */
const TALK_PAUSE_MS = 3000;

/**
 * 挑下一個目的地：從清單裡隨機挑一個「不是目前所在位置」的點。
 * 清單只有一個點、而且已經站在上面時回傳 undefined（不用走）。
 */
export function pickNextDestination(
  destinations: TilePoint[],
  current: TilePoint,
  random: () => number = Math.random
): TilePoint | undefined {
  const candidates = destinations.filter((d) => d.x !== current.x || d.y !== current.y);
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(random() * candidates.length)];
}

function directionTowards(from: TilePoint, to: TilePoint): Direction {
  if (to.x > from.x) return "right";
  if (to.x < from.x) return "left";
  return to.y > from.y ? "down" : "up";
}

/**
 * NPC 出現規則的純函式版本（計畫書 9.1 節），跟 Npc class 分開方便單元測試：
 * 固定時段型比對目前時段是否落在允許範圍，遊走型則用機率擲骰。
 */
export function computeNpcPresence(
  kind: NpcSpawn["kind"],
  currentPeriod: TimePeriod,
  availablePeriods: TimePeriod[] | undefined,
  appearChance: number,
  random: () => number = Math.random
): boolean {
  return kind === "fixed"
    ? !availablePeriods || availablePeriods.includes(currentPeriod)
    : random() < appearChance;
}

/**
 * 地圖上的 NPC。出現與否交由 Game Layer 透過 refreshPresence() 驅動（計畫書 9.1 / 9.4 節）：
 * 固定時段型比對目前時段，遊走型則是每次時段切換重新擲一次機率，兩者都只影響 isPresent，
 * 不會產生任何 Verification Engine 要處理的新語言結構（見第 9.2 節分工原則）。
 *
 * 另外有些 NPC 會在地圖上「走動」（有 destinations）：挑一個目的地、找出路徑一路走過去，
 * 到了之後停留一陣子，再挑下一個目的地。走路速度比玩家慢，玩家追得上。
 * 走動只是畫面上的效果，跟上面「遊走 / 隨機出現型」的出現機率是兩回事；
 * 任務相關的 NPC 都固定待在自己的辦公室，不會走動。
 */
export class Npc extends Entity {
  readonly id: string;
  readonly name: string;
  readonly kind: NpcSpawn["kind"];
  readonly locationLabel: string;
  readonly greeting: string;
  /** NPC 所在的區域（戶外或某棟建築物的某一層），玩家在同一個區域才看得到、碰得到。 */
  readonly areaId: string;
  readonly service?: NpcSpawn["service"];
  readonly printItem?: NpcSpawn["printItem"];
  private readonly availablePeriods?: TimePeriod[];
  private readonly appearChance: number;
  private readonly lines: string[];
  private nextLineIndex = 0;
  private readonly destinations: TilePoint[];
  /** 往目前目的地剩下要走的格子。 */
  private path: TilePoint[] = [];
  private pauseMs: number;
  private blockedMs = 0;
  isPresent = true;

  constructor(spawn: NpcSpawn) {
    const palette = NPC_PALETTES[spawn.paletteKey] ?? PLAYER_PALETTE;
    super(
      spawn.x,
      spawn.y,
      spawn.appearance === "kiosk" ? buildKioskSpriteSet() : buildCharacterSpriteSet(palette)
    );
    this.id = spawn.id;
    this.name = spawn.name;
    this.kind = spawn.kind;
    this.availablePeriods = spawn.availablePeriods;
    this.appearChance = spawn.appearChance ?? 0.5;
    this.locationLabel = spawn.locationLabel;
    this.greeting = spawn.greeting;
    this.areaId = spawn.areaId;
    this.service = spawn.service;
    this.printItem = spawn.printItem;
    this.direction = spawn.direction;
    this.lines = spawn.lines ?? [];
    this.destinations = spawn.destinations ?? [];
    this.pauseMs = randomArrivalPause() / 2;
    if (this.destinations.length > 0) this.moveDurationMs = WALKER_MOVE_DURATION_MS;
  }

  get roams(): boolean {
    return this.destinations.length > 0;
  }

  /** 不屬於任務的閒聊：有多句台詞的 NPC 每次講下一句，講完再從頭輪；沒有的話就講問候語。 */
  nextSmallTalk(): string {
    if (this.lines.length === 0) return this.greeting;
    const line = this.lines[this.nextLineIndex];
    this.nextLineIndex = (this.nextLineIndex + 1) % this.lines.length;
    return line;
  }

  /**
   * 走動型 NPC 每一幀的行為：
   * 停留中就等停留時間結束；沒有路徑就挑下一個目的地並用 BFS 找路；
   * 有路徑就往下一格走，被其他角色擋住就等一下，擋太久就放棄這條路、稍後重新找。
   *
   * canWalk 只看地形（找路用），canEnter 另外檢查這一刻有沒有其他角色擋路（真的移動時用），
   * 兩者都由 Game Layer 提供，NPC 本身不需要知道地圖細節。
   */
  updateRoaming(
    deltaMs: number,
    canWalk: (x: number, y: number) => boolean,
    canEnter: (x: number, y: number) => boolean
  ): void {
    if (!this.roams || this.isMoving) return;
    if (this.pauseMs > 0) {
      this.pauseMs -= deltaMs;
      return;
    }

    const here = { x: this.tileX, y: this.tileY };
    if (this.path.length === 0) {
      const destination = pickNextDestination(this.destinations, here);
      const path = destination ? findPath(here, destination, canWalk) : null;
      if (!path || path.length === 0) {
        this.pauseMs = randomArrivalPause();
        return;
      }
      this.path = path;
      this.blockedMs = 0;
    }

    const next = this.path[0];
    if (this.tryMove(directionTowards(here, next), canEnter)) {
      this.path.shift();
      this.blockedMs = 0;
      if (this.path.length === 0) this.pauseMs = randomArrivalPause();
      return;
    }

    // 剛被擋住時，先試著把擋路的角色當成障礙物重新找一條繞過去的路（道路夠寬就能錯身）
    if (this.blockedMs === 0) {
      const goal = this.path[this.path.length - 1];
      const detour = findPath(here, goal, canEnter);
      if (detour && detour.length > 0) {
        this.path = detour;
        this.blockedMs = deltaMs;
        return;
      }
    }
    this.blockedMs += deltaMs;
    if (this.blockedMs > BLOCKED_GIVE_UP_MS) {
      this.path = [];
      this.blockedMs = 0;
      this.pauseMs = ARRIVAL_PAUSE_MIN_MS / 2;
    }
  }

  /** 被玩家搭話時轉頭面向玩家，並停下來一陣子，不要講到一半就走掉。 */
  faceTowardsSpeaker(playerDirection: Direction): void {
    const opposite: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };
    this.faceTowards(opposite[playerDirection]);
    this.pauseMs = Math.max(this.pauseMs, TALK_PAUSE_MS);
  }

  /** 依目前時段重新計算是否在場；wandering 型每次呼叫都會重新擲一次機率。 */
  refreshPresence(currentPeriod: TimePeriod): void {
    this.isPresent = computeNpcPresence(
      this.kind,
      currentPeriod,
      this.availablePeriods,
      this.appearChance
    );
  }
}

function randomArrivalPause(): number {
  return ARRIVAL_PAUSE_MIN_MS + Math.random() * (ARRIVAL_PAUSE_MAX_MS - ARRIVAL_PAUSE_MIN_MS);
}
