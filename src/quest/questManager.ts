/** 對應計畫書第 19 節資料驅動設計：行政流程用 JSON 定義，不寫死在程式中。 */
export interface QuestDefinition {
  id: string;
  name: string;
  source: string;
  states: string[];
  transitions: Array<[string, string, string]>;
}

/**
 * Quest 管理骨架。載入 questData.json 並串接 Verifier / Game Layer 的邏輯留待 Phase 3、4 實作。
 */
export class QuestManager {
  private readonly quests: QuestDefinition[] = [];

  loadFrom(definitions: QuestDefinition[]): void {
    this.quests.push(...definitions);
  }

  getQuests(): readonly QuestDefinition[] {
    return this.quests;
  }

  getQuestById(id: string): QuestDefinition | undefined {
    return this.quests.find((quest) => quest.id === id);
  }
}
