export interface FloorOption {
  floor: number;
  /** 例如「3F」。 */
  label: string;
  /** 例如「上 2 層，體力 −8，約 2 分鐘」。 */
  detail: string;
}

/**
 * 樓梯 / 電梯的樓層選單：用鍵盤（↑↓ + Enter，Esc 取消）或直接點選按鈕選擇要去的樓層。
 * 選單本身只負責顯示與選擇，實際的體力 / 時間消耗與換區域由 Game Layer 處理。
 */
export class FloorMenu {
  private readonly rootEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly listEl: HTMLElement;
  private options: FloorOption[] = [];
  private selectedIndex = 0;
  private chooseHandler: ((floor: number) => void) | null = null;
  isOpen = false;

  constructor() {
    const root = document.getElementById("floor-menu");
    const title = document.getElementById("floor-menu-title");
    const list = document.getElementById("floor-menu-options");
    if (!root || !title || !list) {
      throw new Error("找不到樓層選單的 DOM 元素，請確認 index.html 結構");
    }
    this.rootEl = root;
    this.titleEl = title;
    this.listEl = list;
  }

  /** 設定玩家選好樓層時要執行的動作（鍵盤 Enter 與滑鼠點選共用）。 */
  onChoose(handler: (floor: number) => void): void {
    this.chooseHandler = handler;
  }

  open(title: string, options: FloorOption[], initialIndex = 0): void {
    this.options = options;
    this.selectedIndex = Math.min(Math.max(0, initialIndex), Math.max(0, options.length - 1));
    this.titleEl.textContent = title;
    this.listEl.replaceChildren(
      ...options.map((option, index) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "floor-menu-option";
        const label = document.createElement("span");
        label.className = "floor-menu-floor";
        label.textContent = option.label;
        const detail = document.createElement("span");
        detail.className = "floor-menu-detail";
        detail.textContent = option.detail;
        button.append(label, detail);
        button.addEventListener("click", () => {
          this.selectedIndex = index;
          this.confirm();
        });
        item.appendChild(button);
        return item;
      })
    );
    this.rootEl.classList.remove("hidden");
    this.isOpen = true;
    this.renderSelection();
  }

  moveSelection(delta: number): void {
    if (this.options.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.options.length) % this.options.length;
    this.renderSelection();
  }

  confirm(): void {
    const option = this.options[this.selectedIndex];
    this.close();
    if (option) this.chooseHandler?.(option.floor);
  }

  close(): void {
    this.rootEl.classList.add("hidden");
    this.isOpen = false;
  }

  private renderSelection(): void {
    const buttons = this.listEl.querySelectorAll<HTMLButtonElement>(".floor-menu-option");
    buttons.forEach((button, index) => {
      const selected = index === this.selectedIndex;
      button.classList.toggle("selected", selected);
      if (selected) {
        button.setAttribute("aria-current", "true");
        // 科研大樓有 16 層，選項超出選單高度時要把目前選到的那一層捲進畫面。
        button.scrollIntoView({ block: "nearest" });
      } else {
        button.removeAttribute("aria-current");
      }
    });
  }
}
