/**
 * 跟「蹲點碰運氣」節奏有關的成本（計畫書 9.5 節），game.ts 與 pacing.test.ts 共用同一份數值，
 * 調整時測試會一起檢查「玩家無法無限蹲點碰運氣」的節奏是否還成立。
 *
 * 遊走型 NPC 只在時段切換時重新擲一次機率（見 npc.ts 的 refreshPresence），
 * 所以同一個時段內重複去找只會扣體力，不會提高遇到的機會；想重擲就得付出跳轉時段或等待的時間成本。
 */

/** 按 T 跳轉到下一個時段扣的體力。 */
export const ADVANCE_TIME_STAMINA_COST = 15;
/** 去找不在場的 NPC（撲空）扣的體力。 */
export const PROBE_ABSENT_NPC_STAMINA_COST = 5;
/** 體力耗盡觸發臨時任務（吃飯休息）花掉的時間（分鐘）。 */
export const REST_TASK_MINUTES = 60;
