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

const INTERACT_KEYS = new Set(["Enter", "Space"]);

/** 鍵盤輸入管理：方向鍵 / WASD 移動，Enter / Space 互動（邊緣觸發，避免按住連續觸發）。 */
export class InputManager {
  private readonly heldKeys = new Set<string>();
  private interactQueued = false;

  constructor() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (DIRECTION_KEYS[event.code] || INTERACT_KEYS.has(event.code)) {
      event.preventDefault();
    }
    if (INTERACT_KEYS.has(event.code) && !this.heldKeys.has(event.code)) {
      this.interactQueued = true;
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
    if (this.interactQueued) {
      this.interactQueued = false;
      return true;
    }
    return false;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }
}
