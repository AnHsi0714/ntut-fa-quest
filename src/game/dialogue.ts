/** 對話框：用真實 DOM 文字顯示（而非畫在 canvas 上），方便維持可讀字級與 a11y 對比度。 */
export class DialogueBox {
  private readonly boxEl: HTMLElement;
  private readonly speakerEl: HTMLElement;
  private readonly textEl: HTMLElement;
  isOpen = false;

  constructor() {
    const box = document.getElementById("dialogue-box");
    const speaker = document.getElementById("dialogue-speaker");
    const text = document.getElementById("dialogue-text");
    if (!box || !speaker || !text) {
      throw new Error("找不到對話框的 DOM 元素，請確認 index.html 結構");
    }
    this.boxEl = box;
    this.speakerEl = speaker;
    this.textEl = text;
  }

  show(speaker: string, text: string): void {
    this.speakerEl.textContent = speaker;
    this.textEl.textContent = text;
    this.boxEl.classList.remove("hidden");
    this.isOpen = true;
  }

  hide(): void {
    this.boxEl.classList.add("hidden");
    this.isOpen = false;
  }

  toggleClose(): void {
    if (this.isOpen) {
      this.hide();
    }
  }
}
