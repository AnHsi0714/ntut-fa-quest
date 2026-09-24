import type { DFA } from "../automata/DFA";
import type { NFA } from "../automata/NFA";
import type { State } from "../automata/transition";
import type { Verifier } from "../verification/verifier";
import type { QuestDefinition } from "../quest/questManager";
import { computeLayeredLayout, type LayoutPosition } from "./automatonLayout";
import { RESULT_TEXT, resolveResultKind } from "./verificationPanel";

const SVG_NS = "http://www.w3.org/2000/svg";
const NODE_RADIUS = 22;
const SVG_MARGIN = 80;

type ViewMode = "dfa" | "nfa";

export interface AutomatonViewerInput {
  quest: QuestDefinition;
  dfa: DFA;
  nfa?: NFA;
  verifier: Verifier;
}

interface EdgeToDraw {
  from: State;
  to: State;
  label: string;
  style: "default" | "executed" | "expected" | "epsilon";
  order?: number[];
}

/**
 * Automaton Visualization（計畫書第 16 節）：把目前任務的 DFA 畫成 SVG 圖，
 * highlight 目前 State、玩家已經走過的合法 transition（附編號對應 Trace 順序），
 * 以及目前合法的下一步；NFA 類型的 quest 另外可以切換看轉換前的原始 NFA 結構
 * （對應計畫書 22 節 Demo 4：NFA → DFA）。
 */
export class AutomatonViewer {
  private readonly overlayEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly modeToggleEl: HTMLElement;
  private readonly svgContainerEl: HTMLElement;
  private readonly resultEl: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly openButton: HTMLButtonElement;

  private mode: ViewMode = "dfa";
  private opened = false;
  private lastInput: AutomatonViewerInput | null = null;

  constructor() {
    const overlayEl = document.getElementById("automaton-viewer");
    const titleEl = document.getElementById("automaton-viewer-title");
    const modeToggleEl = document.getElementById("automaton-viewer-mode");
    const svgContainerEl = document.getElementById("automaton-viewer-svg");
    const resultEl = document.getElementById("automaton-viewer-result");
    const closeButton = document.getElementById("automaton-viewer-close");
    const openButton = document.getElementById("show-automaton-button");
    if (
      !overlayEl ||
      !titleEl ||
      !modeToggleEl ||
      !svgContainerEl ||
      !resultEl ||
      !(closeButton instanceof HTMLButtonElement) ||
      !(openButton instanceof HTMLButtonElement)
    ) {
      throw new Error("找不到 Automaton Viewer 的 DOM 元素，請確認 index.html 結構");
    }
    this.overlayEl = overlayEl;
    this.titleEl = titleEl;
    this.modeToggleEl = modeToggleEl;
    this.svgContainerEl = svgContainerEl;
    this.resultEl = resultEl;
    this.closeButton = closeButton;
    this.openButton = openButton;

    this.closeButton.addEventListener("click", () => this.close());
    this.overlayEl.addEventListener("click", (event) => {
      if (event.target === this.overlayEl) this.close();
    });
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** 點擊面板上的「顯示 Automaton」按鈕時要做什麼，由 Game 決定（它才知道目前是哪個 quest）。 */
  onOpenRequested(handler: () => void): void {
    this.openButton.addEventListener("click", handler);
  }

  open(input: AutomatonViewerInput): void {
    this.opened = true;
    this.mode = "dfa";
    this.overlayEl.classList.remove("hidden");
    this.render(input);
  }

  close(): void {
    this.opened = false;
    this.overlayEl.classList.add("hidden");
  }

  toggle(input: AutomatonViewerInput): void {
    if (this.opened) this.close();
    else this.open(input);
  }

  /** Verifier 狀態改變時呼叫；視窗沒開著就只記住最新輸入，不用真的重畫。 */
  update(input: AutomatonViewerInput): void {
    this.lastInput = input;
    if (this.opened) this.render(input);
  }

  private render(input: AutomatonViewerInput): void {
    this.lastInput = input;
    const { quest, dfa, nfa, verifier } = input;

    this.titleEl.textContent = `${quest.name}｜Automaton`;
    this.renderModeToggle(quest.type === "nfa");

    if (this.mode === "nfa" && nfa) {
      this.renderNfaGraph(nfa, verifier);
      // 這句中英文混排（NFA / Subset Construction / DFA 穿插中文），pixel-font 對中文字沒有對應
      // 字面、會 fallback 成完全不同大小的字型，中英文混在一起大小會差很多，所以不用 pixel-font。
      this.resultEl.textContent = "NFA 原始結構（Subset Construction 轉成 DFA 之前）";
      this.resultEl.className = "badge badge-idle";
    } else {
      this.renderDfaGraph(dfa, verifier, quest);
      const kind = resolveResultKind(verifier);
      this.resultEl.textContent = RESULT_TEXT[kind];
      this.resultEl.className = `badge badge-${kind} pixel-font`;
    }
  }

  private renderModeToggle(hasNfa: boolean): void {
    this.modeToggleEl.innerHTML = "";
    if (!hasNfa) return;

    this.modeToggleEl.appendChild(
      this.createModeButton("DFA（實際執行）", "dfa")
    );
    this.modeToggleEl.appendChild(
      this.createModeButton("NFA（原始定義）", "nfa")
    );
  }

  private createModeButton(label: string, mode: ViewMode): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = this.mode === mode ? "mode-button mode-active" : "mode-button";
    button.addEventListener("click", () => {
      if (this.mode === mode || !this.lastInput) return;
      this.mode = mode;
      this.render(this.lastInput);
    });
    return button;
  }

  private renderDfaGraph(dfa: DFA, verifier: Verifier, quest: QuestDefinition): void {
    const currentState = verifier.getCurrentState();
    const steps = verifier.getTrace().getSteps();
    const validSteps = steps.filter((step) => step.isValid);
    const lastStep = steps[steps.length - 1];

    const executedOrder = new Map<string, number[]>();
    validSteps.forEach((step, index) => {
      const key = edgeKey(step.fromState, step.toState as State);
      const list = executedOrder.get(key);
      if (list) list.push(index + 1);
      else executedOrder.set(key, [index + 1]);
    });

    const expectedEvents = verifier.isAccepted() ? [] : verifier.getExpectedEvents();
    const expectedTargets = new Set(
      dfa.transitions
        .filter((t) => t.from === currentState && expectedEvents.includes(t.event))
        .map((t) => edgeKey(t.from, t.to))
    );

    const edges: EdgeToDraw[] = dfa.transitions.map((transition) => {
      const key = edgeKey(transition.from, transition.to);
      const label = quest.eventLabels[transition.event] ?? transition.event;
      if (executedOrder.has(key)) {
        return { from: transition.from, to: transition.to, label, style: "executed", order: executedOrder.get(key) };
      }
      if (expectedTargets.has(key)) {
        return { from: transition.from, to: transition.to, label, style: "expected" };
      }
      return { from: transition.from, to: transition.to, label, style: "default" };
    });

    const isRejected = lastStep !== undefined && !lastStep.isValid;
    const positions = computeLayeredLayout(dfa.states, dfa.transitions);
    const svg = this.buildSvg(dfa.states, positions, edges, {
      initialState: dfa.initialState,
      acceptingStates: new Set(dfa.acceptingStates),
      currentStates: new Set([currentState]),
      rejectedState: isRejected ? lastStep.fromState : undefined,
      // REJECT 時附上「剛才送出但沒有對應 transition 的事件」，對應計畫書 15 節的
      // 「顯示目前 Event」「顯示錯誤位置」：紅色虛線只是個沒有終點的短箭頭（本來就沒有這條
      // transition），純粹用來標出「在哪個 state、送了什麼事件」才被 REJECT。
      rejectedEvent: isRejected ? (quest.eventLabels[lastStep.event] ?? lastStep.event) : undefined,
    });

    this.svgContainerEl.innerHTML = "";
    this.svgContainerEl.appendChild(svg);
  }

  /**
   * NFA 原始結構檢視：DFA 的 state 名稱本身就是把「當時同時處在哪些 NFA state」的名字
   * 用 " + " 接起來（見 nfaToDfa.ts 的 subsetKey），所以只要把目前 DFA state 拆開，
   * 就能反推出「NFA 現在同時活在哪幾個 state」，藉此讓 NFA 檢視畫面也能同步 highlight
   * 目前狀態——這正是 NFA 跟 DFA 最大的不同（同時處在多個 state），值得在畫面上呈現出來。
   */
  private renderNfaGraph(nfa: NFA, verifier: Verifier): void {
    const edges: EdgeToDraw[] = [];
    for (const transition of nfa.transitions) {
      for (const to of transition.to) {
        edges.push({ from: transition.from, to, label: transition.event, style: "default" });
      }
    }
    for (const epsilon of nfa.epsilonTransitions) {
      edges.push({ from: epsilon.from, to: epsilon.to, label: "ε", style: "epsilon" });
    }

    const positions = computeLayeredLayout(
      nfa.states,
      edges.map(({ from, to }) => ({ from, to }))
    );
    const activeNfaStates = new Set(verifier.getCurrentState().split(" + "));
    const svg = this.buildSvg(nfa.states, positions, edges, {
      initialState: nfa.initialState,
      acceptingStates: new Set(nfa.acceptingStates),
      currentStates: activeNfaStates,
    });

    this.svgContainerEl.innerHTML = "";
    this.svgContainerEl.appendChild(svg);
  }

  private buildSvg(
    states: readonly State[],
    positions: Map<State, LayoutPosition>,
    edges: EdgeToDraw[],
    options: {
      initialState: State;
      acceptingStates: Set<State>;
      /** DFA 只會有一個目前 state；NFA 檢視模式可能同時 highlight 好幾個 state。 */
      currentStates?: Set<State>;
      rejectedState?: State;
      rejectedEvent?: string;
    }
  ): SVGSVGElement {
    const allY = states.map((state) => (positions.get(state) as LayoutPosition).y);
    const allX = states.map((state) => (positions.get(state) as LayoutPosition).x);
    const minY = Math.min(...allY);
    const minX = Math.min(...allX);
    const offsetY = -minY + SVG_MARGIN;
    // initial state 左邊還要留給 buildStartMarkerElement 的短箭頭，所以起點的 x 也要位移，
    // 不能只位移 y；不然 dagre 給的最左邊 x（大約是節點半徑）會讓箭頭一部分落在 viewBox 外面。
    const offsetX = -minX + SVG_MARGIN;
    const width = Math.max(...allX) - minX + SVG_MARGIN * 2;
    const height = Math.max(...allY) - minY + SVG_MARGIN * 2;

    const at = (state: State): LayoutPosition => {
      const raw = positions.get(state) as LayoutPosition;
      return { x: raw.x + offsetX, y: raw.y + offsetY };
    };

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Automaton 狀態圖");
    svg.appendChild(this.buildMarkerDefs());

    const edgeGroup = document.createElementNS(SVG_NS, "g");
    edgeGroup.setAttribute("class", "automaton-edges");

    // 同一對 (from, to) 若有多條邊（例如不同事件走到同一個下一個 state），
    // 用小小的弧度把它們分開，不然線會疊在一起看不出來有好幾條。
    const groups = new Map<string, EdgeToDraw[]>();
    for (const edge of edges) {
      const key = edgeKey(edge.from, edge.to);
      const list = groups.get(key);
      if (list) list.push(edge);
      else groups.set(key, [edge]);
    }

    for (const group of groups.values()) {
      group.forEach((edge, index) => {
        const curve = (index - (group.length - 1) / 2) * 26;
        edgeGroup.appendChild(this.buildEdgeElement(edge, at(edge.from), at(edge.to), curve));
      });
    }
    svg.appendChild(edgeGroup);

    // 指向 initial state 的短箭頭，標示流程從哪裡開始。
    const initialPos = at(options.initialState);
    svg.appendChild(this.buildStartMarkerElement(initialPos));

    const nodeGroup = document.createElementNS(SVG_NS, "g");
    nodeGroup.setAttribute("class", "automaton-nodes");
    for (const state of states) {
      nodeGroup.appendChild(
        this.buildNodeElement(state, at(state), {
          isAccepting: options.acceptingStates.has(state),
          isCurrent: options.currentStates?.has(state) ?? false,
          isRejectedFrom: state === options.rejectedState,
        })
      );
    }
    svg.appendChild(nodeGroup);

    if (options.rejectedState && options.rejectedEvent) {
      svg.appendChild(this.buildRejectStub(at(options.rejectedState), options.rejectedEvent));
    }

    return svg;
  }

  private buildMarkerDefs(): SVGDefsElement {
    const defs = document.createElementNS(SVG_NS, "defs");
    const specs: Array<[id: string, className: string]> = [
      ["arrow-default", "automaton-arrow-default"],
      ["arrow-executed", "automaton-arrow-executed"],
      ["arrow-expected", "automaton-arrow-expected"],
      ["arrow-epsilon", "automaton-arrow-epsilon"],
      ["arrow-reject", "automaton-arrow-reject"],
    ];
    for (const [id, className] of specs) {
      const marker = document.createElementNS(SVG_NS, "marker");
      marker.setAttribute("id", id);
      marker.setAttribute("viewBox", "0 0 10 10");
      marker.setAttribute("refX", "9");
      marker.setAttribute("refY", "5");
      marker.setAttribute("markerWidth", "7");
      marker.setAttribute("markerHeight", "7");
      marker.setAttribute("orient", "auto-start-reverse");
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
      path.setAttribute("class", className);
      marker.appendChild(path);
      defs.appendChild(marker);
    }
    return defs;
  }

  private buildEdgeElement(
    edge: EdgeToDraw,
    from: LayoutPosition,
    to: LayoutPosition,
    curveOffset: number
  ): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", `automaton-edge automaton-edge-${edge.style}`);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy) || 1;
    const ux = dx / distance;
    const uy = dy / distance;
    const startX = from.x + ux * NODE_RADIUS;
    const startY = from.y + uy * NODE_RADIUS;
    const endX = to.x - ux * NODE_RADIUS;
    const endY = to.y - uy * NODE_RADIUS;
    const nx = -uy;
    const ny = ux;
    const controlX = (startX + endX) / 2 + nx * curveOffset;
    const controlY = (startY + endY) / 2 + ny * curveOffset;

    const path = document.createElementNS(SVG_NS, "path");
    const d =
      curveOffset === 0
        ? `M ${startX} ${startY} L ${endX} ${endY}`
        : `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
    path.setAttribute("d", d);
    path.setAttribute("class", "automaton-edge-path");
    path.setAttribute("marker-end", `url(#arrow-${edge.style === "default" ? "default" : edge.style})`);
    group.appendChild(path);

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", String(controlX));
    label.setAttribute("y", String(controlY - 6));
    label.setAttribute("class", "automaton-edge-label");
    label.setAttribute("text-anchor", "middle");
    label.textContent = edge.order ? `${edge.order.join(",")}. ${edge.label}` : edge.label;
    group.appendChild(label);

    return group;
  }

  private buildStartMarkerElement(pos: LayoutPosition): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "automaton-start-marker");
    const line = document.createElementNS(SVG_NS, "path");
    line.setAttribute(
      "d",
      `M ${pos.x - NODE_RADIUS - 34} ${pos.y} L ${pos.x - NODE_RADIUS - 2} ${pos.y}`
    );
    line.setAttribute("marker-end", "url(#arrow-default)");
    line.setAttribute("class", "automaton-edge-path");
    group.appendChild(line);
    return group;
  }

  /**
   * REJECT 時畫在被拒絕的 state 上方的自我迴圈：REJECT 不會換 state（見 verifier.ts
   * handleEvent，無效事件時 state 維持原地），畫成一條「繞回自己」的虛線迴圈，比畫一條
   * 指向空中的線更準確地表達「送了這個事件，但 state 沒有改變」（計畫書 15 節：
   * 顯示目前 Event、顯示錯誤位置）。
   */
  private buildRejectStub(pos: LayoutPosition, eventLabel: string): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "automaton-reject-stub");

    const anchorHalfWidth = 11;
    const loopHeight = 30;
    const startX = pos.x - anchorHalfWidth;
    const endX = pos.x + anchorHalfWidth;
    const edgeY = pos.y - NODE_RADIUS + 3;
    const apexY = pos.y - NODE_RADIUS - loopHeight;

    const loop = document.createElementNS(SVG_NS, "path");
    loop.setAttribute(
      "d",
      `M ${startX} ${edgeY} C ${pos.x - anchorHalfWidth - 18} ${apexY}, ${pos.x + anchorHalfWidth + 18} ${apexY}, ${endX} ${edgeY}`
    );
    loop.setAttribute("class", "automaton-reject-line");
    loop.setAttribute("marker-end", "url(#arrow-reject)");
    group.appendChild(loop);

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", String(pos.x));
    label.setAttribute("y", String(apexY - 6));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "automaton-reject-label");
    label.textContent = `✗ ${eventLabel}`;
    group.appendChild(label);

    return group;
  }

  private buildNodeElement(
    state: State,
    pos: LayoutPosition,
    flags: { isAccepting: boolean; isCurrent: boolean; isRejectedFrom: boolean }
  ): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute(
      "class",
      `automaton-node${flags.isCurrent ? " automaton-node-current" : ""}${
        flags.isRejectedFrom ? " automaton-node-rejected" : ""
      }`
    );

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", String(pos.x));
    circle.setAttribute("cy", String(pos.y));
    circle.setAttribute("r", String(NODE_RADIUS));
    circle.setAttribute("class", "automaton-node-circle");
    group.appendChild(circle);

    if (flags.isAccepting) {
      const ring = document.createElementNS(SVG_NS, "circle");
      ring.setAttribute("cx", String(pos.x));
      ring.setAttribute("cy", String(pos.y));
      ring.setAttribute("r", String(NODE_RADIUS - 5));
      ring.setAttribute("class", "automaton-node-accept-ring");
      group.appendChild(ring);
    }

    const lines = state.split(" + ");
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(pos.x));
    text.setAttribute("y", String(pos.y + NODE_RADIUS + 14));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "automaton-node-label");
    lines.forEach((line, index) => {
      const tspan = document.createElementNS(SVG_NS, "tspan");
      tspan.setAttribute("x", String(pos.x));
      tspan.setAttribute("dy", index === 0 ? "0" : "1.2em");
      tspan.textContent = line;
      text.appendChild(tspan);
    });
    group.appendChild(text);

    return group;
  }
}

function edgeKey(from: State, to: State): string {
  return `${from} ${to}`;
}
