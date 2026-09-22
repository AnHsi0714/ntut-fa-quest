import { NFA } from "./NFA";
import { DFA } from "./DFA";
import type { State, Transition } from "./transition";

/**
 * 把一組 NFA state 變成穩定排序的字串 key，當作 DFA 的 state 名稱（方便在畫面上直接看到
 * 「目前同時處在哪些 NFA state」）。分隔符特意留空格，讓 UI 端可以在這裡自然換行，
 * 不會因為 state 名稱變長就把整排版面撐開。
 */
function subsetKey(states: Set<State>): State {
  if (states.size === 0) return "∅";
  return [...states].sort().join(" + ");
}

/**
 * NFA → DFA（計畫書第 13 節，Subset Construction）。
 * 從 initial state 的 ε-closure 開始，對每個目前可能的 state 集合、每個字母表符號，
 * 算出「走這個符號後，ε-closure 展開出的下一個集合」，把每個集合本身當成一個新的 DFA state。
 */
export function nfaToDfa(nfa: NFA): DFA {
  const startSubset = nfa.epsilonClosure([nfa.initialState]);
  const startKey = subsetKey(startSubset);

  const subsetsByKey = new Map<State, Set<State>>([[startKey, startSubset]]);
  const dfaTransitions: Transition[] = [];
  const queue: State[] = [startKey];
  const seen = new Set<State>([startKey]);

  while (queue.length > 0) {
    const key = queue.shift() as State;
    const subset = subsetsByKey.get(key) as Set<State>;

    for (const event of nfa.alphabet) {
      const reached = new Set<State>();
      for (const state of subset) {
        for (const target of nfa.getNextStates(state, event)) {
          reached.add(target);
        }
      }
      if (reached.size === 0) continue;

      const closure = nfa.epsilonClosure(reached);
      const closureKey = subsetKey(closure);
      dfaTransitions.push({ from: key, event, to: closureKey });

      if (!seen.has(closureKey)) {
        seen.add(closureKey);
        subsetsByKey.set(closureKey, closure);
        queue.push(closureKey);
      }
    }
  }

  const dfaStates = [...subsetsByKey.keys()];
  const acceptingStates = dfaStates.filter((key) => {
    const subset = subsetsByKey.get(key) as Set<State>;
    return [...subset].some((state) => nfa.acceptingStates.includes(state));
  });

  return new DFA(dfaStates, nfa.alphabet, dfaTransitions, startKey, acceptingStates);
}
