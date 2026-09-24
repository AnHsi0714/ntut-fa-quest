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
  Escape: "closeAutomaton",
};

/**
 * 鍵盤輸入管理：方向鍵 / WASD 移動，Enter / Space 互動、Q 切換任務、T 跳轉時間、
 * V 顯示 / 關閉 Automaton 視窗（計畫書第 16 節）、Esc 關閉 Automaton 視窗（皆為邊緣觸發）。
 */
export class InputManager {
  private readonly heldKeys = new Set<string>();
  private readonly queuedActions = new Set<string>();

  constructor() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (DIRECTION_KEYS[event.code] || ACTION_KEYS[event.code]) {
      event.preventDefault();
    }
    const action = ACTION_KEYS[event.code];
    if (action && !this.heldKeys.has(event.code)) {
      this.queuedActions.add(action);
    }
    this.heldKeys.add(event.code);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.heldKeys.delete(event.code);
  };

  /** 目前按住的方向（若同時按多個方向鍵，取第一個找到的）。 */
  getHeldDirection(): Direction | null {
    for (const code of this.heldKeys) {
      const direction = DIRECTION_KEYS[code];
      if (direction) return direction;
    }
    return null;
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

  /** 讀取「這一幀是否按了 Esc」，讀取後會自動重置。 */
  consumeCloseAutomaton(): boolean {
    return this.consumeAction("closeAutomaton");
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
  }
}
