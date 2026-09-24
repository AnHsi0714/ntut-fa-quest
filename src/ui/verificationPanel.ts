import type { Verifier } from "../verification/verifier";
import type { QuestDefinition } from "../quest/questManager";

export type ResultKind = "accept" | "reject" | "pending" | "idle";

export const RESULT_TEXT: Record<ResultKind, string> = {
  accept: "✓ ACCEPT",
  reject: "✗ REJECT（Invalid Transition）",
  pending: "進行中",
  idle: "尚未開始",
};

/** ACCEPT / REJECT / 進行中 / 尚未開始 的判斷邏輯，Verification Panel 跟 Automaton Viewer 共用。 */
export function resolveResultKind(verifier: Verifier): ResultKind {
  const steps = verifier.getTrace().getSteps();
  const lastStep = steps[steps.length - 1];

  if (verifier.isAccepted()) return "accept";
  if (lastStep && !lastStep.isValid) return "reject";
  if (steps.length > 0) return "pending";
  return "idle";
}

/** Trace / ACCEPT / REJECT 顯示面板（計畫書第 15 節）。 */
export class VerificationPanel {
  private readonly stateEl: HTMLElement;
  private readonly resultEl: HTMLElement;
  private readonly traceEl: HTMLElement;

  constructor() {
    const stateEl = document.getElementById("verification-state");
    const resultEl = document.getElementById("verification-result");
    const traceEl = document.getElementById("verification-trace");
    if (!stateEl || !resultEl || !traceEl) {
      throw new Error("找不到 Verification Panel 的 DOM 元素，請確認 index.html 結構");
    }
    this.stateEl = stateEl;
    this.resultEl = resultEl;
    this.traceEl = traceEl;
  }

  render(verifier: Verifier, quest: QuestDefinition): void {
    this.stateEl.textContent = verifier.getCurrentState();
    this.setResult(resolveResultKind(verifier));

    const steps = verifier.getTrace().getSteps();
    this.traceEl.innerHTML = "";
    for (const step of steps) {
      const li = document.createElement("li");
      li.className = step.isValid ? "trace-valid" : "trace-invalid";
      const label = quest.eventLabels[step.event] ?? step.event;
      const arrowTarget = step.toState ?? "—";
      li.textContent = `${step.isValid ? "✓" : "✗"} ${label}（${step.fromState} → ${arrowTarget}）`;
      this.traceEl.appendChild(li);
    }
  }

  private setResult(kind: ResultKind): void {
    this.resultEl.textContent = RESULT_TEXT[kind];
    this.resultEl.className = `badge badge-${kind}`;
  }
}
