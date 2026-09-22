import type { Npc } from "./npc";
import type { Camera } from "./camera";
import { TILE_SIZE } from "./tileArt";

/**
 * NPC 名稱標籤改用真實 DOM 文字顯示，而不是畫在 canvas 上。
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

  sync(npcs: Npc[], camera: Camera, canvas: HTMLCanvasElement): void {
    const scale = canvas.clientWidth / canvas.width || 1;
    const seenIds = new Set<string>();

    for (const npc of npcs) {
      seenIds.add(npc.id);
      const label = this.getOrCreateLabel(npc);
      const screenX = (npc.pixelX - camera.x + TILE_SIZE / 2) * scale;
      const screenY = (npc.pixelY - camera.y) * scale;
      label.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -100%)`;
    }

    for (const [id, el] of this.labelEls) {
      if (!seenIds.has(id)) {
        el.remove();
        this.labelEls.delete(id);
      }
    }
  }

  private getOrCreateLabel(npc: Npc): HTMLDivElement {
    let label = this.labelEls.get(npc.id);
    if (!label) {
      label = document.createElement("div");
      label.className = "npc-label";
      label.textContent = npc.name;
      this.container.appendChild(label);
      this.labelEls.set(npc.id, label);
    }
    return label;
  }
}
