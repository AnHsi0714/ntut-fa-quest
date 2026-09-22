import type { Verifier } from "../verification/verifier";
import type { QuestDefinition } from "../quest/questManager";

type ResultKind = "accept" | "reject" | "pending" | "idle";

const RESULT_TEXT: Record<ResultKind, string> = {
  accept: "✓ ACCEPT",
  reject: "✗ REJECT（Invalid Transition）",
  pending: "進行中",
  idle: "尚未開始",
};

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

    const steps = verifier.getTrace().getSteps();
    const lastStep = steps[steps.length - 1];

    if (verifier.isAccepted()) {
      this.setResult("accept");
    } else if (lastStep && !lastStep.isValid) {
      this.setResult("reject");
    } else if (steps.length > 0) {
      this.setResult("pending");
    } else {
      this.setResult("idle");
    }

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
