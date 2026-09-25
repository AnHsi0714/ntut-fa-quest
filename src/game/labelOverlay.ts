import type { Camera } from "./camera";
import { TILE_SIZE } from "./tileArt";

/** 要顯示在地圖上的一個文字標籤；座標是「地圖像素」，標籤會水平置中、貼在這個點的上方。 */
export interface OverlayLabel {
  key: string;
  text: string;
  pixelX: number;
  pixelY: number;
  /** npc：角色名稱；place：建築物 / 房間名稱。 */
  variant: "npc" | "place";
}

/**
 * NPC 與地點名稱標籤改用真實 DOM 文字顯示，而不是畫在 canvas 上。
 * canvas 是用低解析度繪製、靠 CSS image-rendering: pixelated 放大出像素風格，
 * 如果把文字也畫進 canvas 再一起被放大，文字邊緣的反鋸齒會被最近鄰演算法放大成模糊的色塊。
 * 改成 DOM 元素後文字維持螢幕原生解析度，不會受 canvas 縮放影響。
 */
export class LabelOverlay {
  private readonly container: HTMLElement;
  private readonly labelEls = new Map<string, HTMLDivElement>();

  constructor() {
    const el = document.getElementById("npc-labels");
    if (!el) throw new Error("找不到 #npc-labels，請確認 index.html 結構");
    this.container = el;
  }

  sync(labels: OverlayLabel[], camera: Camera, canvas: HTMLCanvasElement): void {
    const scale = canvas.clientWidth / canvas.width || 1;
    const viewWidth = canvas.width;
    const viewHeight = canvas.height;
    const seenKeys = new Set<string>();

    for (const item of labels) {
      const localX = item.pixelX - camera.x;
      const localY = item.pixelY - camera.y;
      // 畫面外很遠的標籤不需要放進 DOM（戶外地圖有十幾棟建築物）。
      if (localX < -TILE_SIZE * 4 || localX > viewWidth + TILE_SIZE * 4) continue;
      if (localY < -TILE_SIZE || localY > viewHeight + TILE_SIZE * 2) continue;

      seenKeys.add(item.key);
      const label = this.getOrCreateLabel(item);
      label.style.transform = `translate(${localX * scale}px, ${localY * scale}px) translate(-50%, -100%)`;
    }

    for (const [key, el] of this.labelEls) {
      if (!seenKeys.has(key)) {
        el.remove();
        this.labelEls.delete(key);
      }
    }
  }

  private getOrCreateLabel(item: OverlayLabel): HTMLDivElement {
    let label = this.labelEls.get(item.key);
    if (!label) {
      label = document.createElement("div");
      label.className = item.variant === "npc" ? "npc-label" : "place-label";
      this.container.appendChild(label);
      this.labelEls.set(item.key, label);
    }
    if (label.textContent !== item.text) label.textContent = item.text;
    return label;
  }
}

/** 格子座標（可以是小數）轉成標籤要貼的地圖像素座標：格子上緣、水平置中。 */
export function tileLabelAnchor(tileX: number, tileY: number): { pixelX: number; pixelY: number } {
  return { pixelX: tileX * TILE_SIZE + TILE_SIZE / 2, pixelY: tileY * TILE_SIZE };
}
