import type { Direction } from "./pixelSprite";

const DIRECTION_KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

/** 按一下才觸發一次的按鍵（跟移動鍵不同，不會因為按住而連續觸發）。 */
const ACTION_KEYS: Record<string, string> = {
  Enter: "interact",
  Space: "interact",
  KeyQ: "cycleQuest",
  KeyT: "advanceTime",
  KeyV: "toggleAutomaton",
  Escape: "cancel",
};

/**
 * 鍵盤輸入管理：方向鍵 / WASD 移動，Enter / Space 互動、Q 切換任務、T 跳轉時間、
 * V 顯示 / 關閉 Automaton 視窗（計畫書第 16 節）、Esc 關閉視窗或取消選單（皆為邊緣觸發）。
 * 方向鍵除了「按住持續移動」之外，也會記錄一次性的按下事件，給樓層選單這類需要逐格移動游標的 UI 使用。
 */
export class InputManager {
  private readonly heldKeys = new Set<string>();
  private readonly queuedActions = new Set<string>();
  private readonly queuedDirections: Direction[] = [];
  /**
   * 是否按著 Shift（跑步）：直接讀瀏覽器算好的 event.shiftKey，而不是自己追蹤
   * ShiftLeft / ShiftRight 兩顆鍵個別的按下 / 放開。改用這個是因為之前發現只有左邊
   * Shift 有反應：自己追蹤 code 遇到漏掉的 keyup（例如切換視窗焦點時）就會卡住或失準，
   * shiftKey 是瀏覽器依當下鍵盤狀態即時算出來的，不管按哪一顆 Shift 都可靠。
   */
  private shiftHeld = false;

  constructor() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    // 視窗失去焦點時（切換視窗、按 Alt+Tab）不會再收到 keyup，放開的按鍵會卡在「按著」的狀態，
    // 回來後角色會一直亂走；焦點一離開就整批清空，回來後玩家得重新按一次才會動，但不會卡死。
    window.addEventListener("blur", this.handleBlur);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (DIRECTION_KEYS[event.code] || ACTION_KEYS[event.code]) {
      event.preventDefault();
    }
    const action = ACTION_KEYS[event.code];
    if (action && !this.heldKeys.has(event.code)) {
      this.queuedActions.add(action);
    }
    const direction = DIRECTION_KEYS[event.code];
    if (direction && !this.heldKeys.has(event.code)) {
      this.queuedDirections.push(direction);
    }
    this.heldKeys.add(event.code);
    this.shiftHeld = event.shiftKey;
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.heldKeys.delete(event.code);
    this.shiftHeld = event.shiftKey;
  };

  private handleBlur = (): void => {
    this.heldKeys.clear();
    this.shiftHeld = false;
  };

  /** 目前按住的方向（若同時按多個方向鍵，取第一個找到的）。 */
  getHeldDirection(): Direction | null {
    for (const code of this.heldKeys) {
      const direction = DIRECTION_KEYS[code];
      if (direction) return direction;
    }
    return null;
  }

  /** 是否按住 Shift（跑步），不分左右。 */
  isRunHeld(): boolean {
    return this.shiftHeld;
  }

  /** 讀取「這一幀是否觸發互動」，讀取後會自動重置，等同邊緣觸發。 */
  consumeInteract(): boolean {
    return this.consumeAction("interact");
  }

  /** 讀取「這一幀是否按了切換任務鍵」，讀取後會自動重置。 */
  consumeCycleQuest(): boolean {
    return this.consumeAction("cycleQuest");
  }

  /** 讀取「這一幀是否按了跳轉時間鍵」，讀取後會自動重置。 */
  consumeAdvanceTime(): boolean {
    return this.consumeAction("advanceTime");
  }

  /** 讀取「這一幀是否按了顯示 / 關閉 Automaton 鍵（V）」，讀取後會自動重置。 */
  consumeToggleAutomaton(): boolean {
    return this.consumeAction("toggleAutomaton");
  }

  /** 讀取「這一幀是否按了 Esc」（關閉視窗 / 取消選單），讀取後會自動重置。 */
  consumeCancel(): boolean {
    return this.consumeAction("cancel");
  }

  /** 取出最早一次「按下方向鍵」的事件（不是按住狀態），沒有則回傳 null。 */
  consumeDirectionPress(): Direction | null {
    return this.queuedDirections.shift() ?? null;
  }

  /** 丟掉還沒處理的一次性方向鍵事件，避免關掉選單後殘留的按鍵被下一個選單讀到。 */
  clearDirectionPresses(): void {
    this.queuedDirections.length = 0;
  }

  private consumeAction(action: string): boolean {
    if (this.queuedActions.has(action)) {
      this.queuedActions.delete(action);
      return true;
    }
    return false;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
  }
}
