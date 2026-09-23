/**
 * 體力系統（計畫書第 9.5 節）：移動、跳轉時間、對缺席 NPC 碰運氣都會消耗體力。
 * 體力歸零時由 Game Layer 觸發臨時任務（見 game.ts 的 maybeTriggerRestTask），
 * 臨時任務屬於純遊戲層機制，不會被記錄進 Verification 用的 Trace。
 */
export class StaminaSystem {
  private readonly maxStamina = 100;
  private stamina = 100;

  get current(): number {
    return this.stamina;
  }

  get max(): number {
    return this.maxStamina;
  }

  get isDepleted(): boolean {
    return this.stamina <= 0;
  }

  /** 消耗體力（移動、等待、碰運氣皆會呼叫）；歸零後由呼叫端判斷是否觸發臨時任務。 */
  consume(amount: number): void {
    this.stamina = Math.max(0, this.stamina - amount);
  }

  restore(amount: number): void {
    this.stamina = Math.min(this.maxStamina, this.stamina + amount);
  }
}
