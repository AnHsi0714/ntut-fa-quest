import dagre from "@dagrejs/dagre";
import type { State } from "../automata/transition";

export interface LayoutPosition {
  x: number;
  y: number;
}

export interface LayoutEdge {
  from: State;
  to: State;
}

/** 跟 AutomatonViewer 的 NODE_RADIUS（22）對齊，讓 dagre 抓的節點間距跟實際畫出來的圓圈大小一致。 */
const NODE_SIZE = 44;
const NODE_SEP = 60;
const RANK_SEP = 110;

/**
 * Automaton Viewer 的排版邏輯（計畫書第 16 節）：交給 dagre（Sugiyama-style 分層排版演算法）
 * 處理，不自己刻分層演算法。DFA / NFA 目前的規模（幾個到十幾個 state）用哪種排版都看得出來，
 * 但之後文件流程一多、分支變複雜，dagre 的 rank 指派＋layer 內排序（減少邊交叉）會比自己寫的
 * 簡單 BFS 分層更好維護、畫出來也更整齊，所以一開始就用 dagre，不用等排版變醜了才換。
 * `acyclicer: "greedy"` 是保底：目前的 DFA/NFA 都是無環圖，但之後若真的出現迴圈（例如某個
 * transition 繞回前面的 state），dagre 也不會因為有環就排版失敗。
 * DFA 跟 NFA 共用同一個函式，邊只需要 from/to，不需要知道事件名稱。
 */
export function computeLayeredLayout(
  states: readonly State[],
  edges: readonly LayoutEdge[]
): Map<State, LayoutPosition> {
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({ rankdir: "LR", nodesep: NODE_SEP, ranksep: RANK_SEP, acyclicer: "greedy" });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const state of states) {
    graph.setNode(state, { width: NODE_SIZE, height: NODE_SIZE });
  }
  edges.forEach((edge, index) => {
    // 用第三個參數（name）把每條邊都當成 multigraph 裡的獨立邊，這樣同一對 (from, to)
    // 之間有多條 transition（例如不同事件走到同一個下一個 state）也不會互相覆蓋掉。
    graph.setEdge(edge.from, edge.to, {}, `e${index}`);
  });

  dagre.layout(graph);

  const positions = new Map<State, LayoutPosition>();
  for (const state of states) {
    const node = graph.node(state);
    positions.set(state, { x: node.x, y: node.y });
  }
  return positions;
}
