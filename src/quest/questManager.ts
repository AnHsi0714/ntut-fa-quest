import { DFA } from "../automata/DFA";
import type { Transition } from "../automata/transition";

/** 對應計畫書第 19 節資料驅動設計：行政流程用 JSON 定義，不寫死在程式中。 */
export interface QuestDefinition {
  id: string;
  name: string;
  source: string;
  states: string[];
  initialState: string;
  acceptingStates: string[];
  transitions: Array<[string, string, string]>;
  /** 事件代碼 → 給玩家看的中文描述，用於 Verification Panel 顯示「預期下一步」。 */
  eventLabels: Record<string, string>;
}

/** 依計畫書第 19 節的 JSON 格式，把 Quest 的流程定義轉換成第 11 節的 DFA。 */
export function buildDfaFromQuest(quest: QuestDefinition): DFA {
  const transitions: Transition[] = quest.transitions.map(([from, event, to]) => ({
    from,
    event,
    to,
  }));
  const alphabet = [...new Set(transitions.map((t) => t.event))];
  return new DFA(quest.states, alphabet, transitions, quest.initialState, quest.acceptingStates);
}

/** Quest 管理：載入 questData.json，供 Game Layer 查詢目前要處理哪一個文件流程。 */
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
