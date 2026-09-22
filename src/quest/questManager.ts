import { DFA } from "../automata/DFA";
import { NFA } from "../automata/NFA";
import { nfaToDfa } from "../automata/nfaToDfa";
import type { Transition } from "../automata/transition";

interface QuestDefinitionBase {
  id: string;
  name: string;
  source: string;
  states: string[];
  initialState: string;
  acceptingStates: string[];
  /** 事件代碼 → 給玩家看的中文描述，用於 Verification Panel 顯示「預期下一步」。 */
  eventLabels: Record<string, string>;
  /** NPC id → 這個 NPC 對應到這個 quest 裡的哪個事件（計畫書第 19 節資料驅動設計）。 */
  npcEvents: Record<string, string>;
  /**
   * Quest Panel 步驟清單要顯示的事件，依「自然閱讀順序」排列。
   * 跟 transitions 分開存，是因為 NFA 編譯出來的 DFA state 是好幾個 NFA state 的集合
   * （例如系辦／系主任順序不限時），沒辦法直接用「目前 state 在 states 陣列的第幾個」
   * 這種線性 index 來判斷進度；改成「這個事件是否已經出現在合法 Trace 裡」來判斷完成度，
   * 兩種情況都能用同一套 UI 邏輯處理。
   */
  displaySteps: string[];
}

export interface QuestDfaDefinition extends QuestDefinitionBase {
  type: "dfa";
  transitions: Array<[string, string, string]>;
}

export interface QuestNfaDefinition extends QuestDefinitionBase {
  type: "nfa";
  /** NFA 的 transition 可以有多個目的地，對應「多條合法路徑」。 */
  transitions: Array<[string, string, string[]]>;
  epsilonTransitions?: Array<[string, string]>;
}

export type QuestDefinition = QuestDfaDefinition | QuestNfaDefinition;

function buildDfaFromDefinition(quest: QuestDfaDefinition): DFA {
  const transitions: Transition[] = quest.transitions.map(([from, event, to]) => ({
    from,
    event,
    to,
  }));
  const alphabet = [...new Set(transitions.map((t) => t.event))];
  return new DFA(quest.states, alphabet, transitions, quest.initialState, quest.acceptingStates);
}

function buildDfaFromNfaDefinition(quest: QuestNfaDefinition): DFA {
  const transitions = quest.transitions.map(([from, event, to]) => ({ from, event, to }));
  const alphabet = [...new Set(transitions.map((t) => t.event))];
  const epsilonTransitions = (quest.epsilonTransitions ?? []).map(([from, to]) => ({
    from,
    to,
  }));
  const nfa = new NFA(
    quest.states,
    alphabet,
    transitions,
    epsilonTransitions,
    quest.initialState,
    quest.acceptingStates
  );
  return nfaToDfa(nfa);
}

/**
 * 依計畫書第 19 節的 JSON 格式，把 Quest 的流程定義轉換成實際可以拿來跑遊戲的 DFA。
 * 如果 quest 本身是用 NFA 定義的（例如「兩件事、順序不限」），會先組出 NFA，
 * 再用第 13 節的 subset construction 轉成 DFA —— Verifier 永遠只需要面對 DFA。
 */
export function buildAutomatonForQuest(quest: QuestDefinition): DFA {
  return quest.type === "nfa" ? buildDfaFromNfaDefinition(quest) : buildDfaFromDefinition(quest);
}

/** Quest 管理：載入 questData.json，供 Game Layer 查詢目前有哪些文件流程可以進行。 */
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
