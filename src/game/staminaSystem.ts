/**
 * 體力系統骨架（計畫書第 9.5 節）。
 * 框架版本先提供數值與基本消耗 / 恢復方法，觸發臨時任務的邏輯留待 Phase 4 後續項目串接，
 * 且依計畫書設計，臨時任務屬於純遊戲層機制，不會被記錄進 Verification 用的 Trace。
 */
export class StaminaSystem {
  private readonly maxStamina = 100;
  private stamina = 100;

  get current(): number {
    return this.stamina;
  }

  get isDepleted(): boolean {
    return this.stamina <= 0;
  }

  /** 消耗體力（移動、等待、碰運氣皆會呼叫）。TODO：歸零時觸發臨時任務。 */
  consume(amount: number): void {
    this.stamina = Math.max(0, this.stamina - amount);
  }

  restore(amount: number): void {
    this.stamina = Math.min(this.maxStamina, this.stamina + amount);
  }
}
