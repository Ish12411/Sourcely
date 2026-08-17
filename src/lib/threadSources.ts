import type { Source, Turn } from "./types";

export type RailSource = {
  /** The source, renumbered to its thread-wide position. */
  source: Source;
  /** Stable for the life of the thread. */
  threadNumber: number;
  /** 1-based question this source first appeared in. */
  questionNumber: number;
};

export type ThreadSources = {
  rail: RailSource[];
  /**
   * turn id -> (the number the model used within that turn -> thread number).
   * Prose markers are stored per-turn, so they must be translated before
   * they can point at the rail.
   */
  numberMap: Map<string, Map<number, number>>;
};

/**
 * Collect every source in the thread into one stably-numbered list.
 *
 * Numbering is assigned on first appearance and never reshuffles, which is
 * what lets a superscript in the first answer keep pointing at the right card
 * after later questions append more sources. Duplicate URLs across turns
 * collapse onto the number they were first given.
 */
export function buildThreadSources(turns: Turn[]): ThreadSources {
  const rail: RailSource[] = [];
  const numberMap = new Map<string, Map<number, number>>();
  const byUrl = new Map<string, number>();

  let questionNumber = 0;

  for (const turn of turns) {
    questionNumber += 1;
    if (turn.status !== "done" || !turn.result) continue;

    const perTurn = new Map<number, number>();

    for (const source of turn.result.sources) {
      const existing = byUrl.get(source.url);
      if (existing !== undefined) {
        perTurn.set(source.number, existing);
        continue;
      }

      const threadNumber = rail.length + 1;
      byUrl.set(source.url, threadNumber);
      perTurn.set(source.number, threadNumber);
      rail.push({
        source: { ...source, number: threadNumber },
        threadNumber,
        questionNumber,
      });
    }

    numberMap.set(turn.id, perTurn);
  }

  return { rail, numberMap };
}

/**
 * A source with neither an author nor a date can't produce a usable reference
 * entry, so it renders collapsed and sorts to the end. Single definition so
 * the ordering and the card rendering can never disagree.
 */
export function isIncomplete(source: Source): boolean {
  return !source.publishedDate && source.authors.length === 0;
}

/**
 * Split the thread into sources that can produce a reference entry and those
 * that can't. The uncitable ones are collected across every question so they
 * gather in a single block at the very bottom, rather than leaving a short
 * stub at the end of each question's group.
 *
 * Numbering is untouched — this is display order only, so a prose marker
 * still resolves to the same card.
 */
export function partitionByCitability(entries: RailSource[]): {
  citable: RailSource[];
  incomplete: RailSource[];
} {
  const citable: RailSource[] = [];
  const incomplete: RailSource[] = [];
  for (const entry of entries) {
    (isIncomplete(entry.source) ? incomplete : citable).push(entry);
  }
  return { citable, incomplete };
}

/**
 * "4–5 from question 2" — the divider label for a later turn's sources.
 *
 * Pulling uncitable sources out to the bottom can leave a group's numbers
 * non-contiguous, so a range is only used when the numbers actually run
 * consecutively; otherwise they're listed. A "5–8" label covering a block
 * that doesn't contain 7 would be a lie about where a citation lives.
 */
export function groupLabel(group: RailSource[]): string {
  const numbers = group.map((g) => g.threadNumber).sort((a, b) => a - b);
  const contiguous = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1);

  const label =
    numbers.length === 1
      ? `${numbers[0]}`
      : contiguous
        ? `${numbers[0]}–${numbers[numbers.length - 1]}`
        : numbers.join(", ");

  return `${label} from question ${group[0].questionNumber}`;
}

/** Split the rail into the first question's sources, then one group per later question. */
export function groupByQuestion(rail: RailSource[]): RailSource[][] {
  const groups: RailSource[][] = [];
  for (const entry of rail) {
    const last = groups[groups.length - 1];
    if (last && last[0].questionNumber === entry.questionNumber) last.push(entry);
    else groups.push([entry]);
  }
  return groups;
}
