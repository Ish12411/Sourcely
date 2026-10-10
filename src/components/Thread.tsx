"use client";

import { useEffect, useState } from "react";
import ResultsView from "./ResultsView";
import type { ResearchProgress, Turn } from "@/lib/types";

export default function Thread({
  turns,
  numberMaps,
  onMarkerClick,
  onRetry,
}: {
  turns: Turn[];
  /** turn id -> (per-turn source number -> thread-wide number) */
  numberMaps: Map<string, Map<number, number>>;
  onMarkerClick: (threadNumber: number) => void;
  onRetry: (turnId: string) => void;
}) {
  return (
    <div>
      {turns.map((turn, i) => (
        <section
          key={turn.id}
          style={
            i > 0
              ? { borderTop: "1px solid var(--rule)", paddingTop: 34, marginTop: 44 }
              : undefined
          }
        >
          {/*
            The question is the largest thing on the page by a wide margin.
            Hierarchy is carried by size alone — no rule, no box, no label
            stacked above it — so the eye lands on what was asked before
            anything else, the way a billing line reads from across a room.
          */}
          {i === 0 ? (
            <h2 className="display" style={{ marginBottom: 26 }}>
              {turn.question}
            </h2>
          ) : (
            <h3
              className="display"
              style={{ fontSize: "1.75rem", letterSpacing: "-0.014em", marginBottom: 20 }}
            >
              {turn.question}
            </h3>
          )}

          {turn.status === "loading" && <TurnLoading progress={turn.progress} seed={turn.id} />}

          {turn.status === "error" && <TurnError turn={turn} onRetry={() => onRetry(turn.id)} />}

          {turn.status === "done" && turn.result && (
            <ResultsView
              result={turn.result}
              numberMap={numberMaps.get(turn.id) ?? new Map()}
              onMarkerClick={onMarkerClick}
              isFirst={i === 0}
            />
          )}
        </section>
      ))}
    </div>
  );
}

type LoadingLine = {
  text: string;
  /** Which of the three steps it belongs to: find, read, write. */
  step: 1 | 2 | 3;
  /** How long to show it before moving on. The last line stays. */
  ms: number;
};

/** A question, clipped to fit the one-line label. */
function quoted(query: string): string {
  const q = query.trim().replace(/[?.!]+$/, "");
  return `“${q.length > 48 ? `${q.slice(0, 47).trimEnd()}…` : q}”`;
}

/*
  Wording pools. Each question draws its own mix (seeded by the turn id, so
  the lines stay put while that question loads), so the wait reads
  differently every time instead of "Searching… Reading…" on repeat. Every
  pool belongs to one real stage: nothing here claims a step the server
  hasn't reported.
*/
const START = ["Getting started", "Opening the library doors", "Warming up the search", "Setting up your research"];
const UNDERSTANDING = [
  "Rereading the thread",
  "Recalling your earlier questions",
  "Connecting this to what you asked before",
  "Picking up where you left off",
  "Working out what you mean",
];
const FINDING = [
  "Combing the web",
  "Hunting for trustworthy pages",
  "Tracking down sources",
  "Sifting through results",
  "Digging a little deeper",
  "Gathering candidates",
  "Looking past the ads",
  "Weeding out weak pages",
  "Lining up the best matches",
];
const FINDING_ACADEMIC = [
  "Browsing journals and archives",
  "Checking university libraries",
  "Consulting government records",
  "Looking through research papers",
];
const FINDING_FILTERED = ["Skipping homework sites and social media", "Leaving out essay mills"];
const FINDING_MORE = ["Looking for sources you haven't seen yet", "Skipping the ones you already have"];
const FOUND = ["Found", "Pulled up", "Gathered", "Turned up"];
const READ_VERBS = ["Reading", "Skimming", "Checking", "Scanning", "Studying", "Going through", "Pulling notes from", "Taking notes on"];
const ANALYSING = [
  "Comparing what the sources say",
  "Cross-checking the facts",
  "Weighing the evidence",
  "Spotting where sources disagree",
  "Connecting the dots",
  "Pulling out the key points",
];
const WRITING = ["Drafting your answer", "Piecing it together", "Writing your answer", "Polishing the wording"];
const CITING = ["Lining up citations", "Numbering the sources", "Formatting references", "Double-checking the details"];
const FINISHING = ["Almost done", "Putting on the finishing touches", "Nearly there"];

/** Small deterministic PRNG, so a turn's wording doesn't reshuffle on re-render. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, list: T[], n: number): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

/**
 * Lines for the stage the server has reported. The real details — the query
 * searched and the sites found — are always in there; the rest is varied
 * wording for the parts of the wait that give no finer signal of their own.
 */
function loadingLines(progress: ResearchProgress | undefined, seed: string): LoadingLine[] {
  const rand = seeded(`${seed}:${progress?.stage ?? "start"}`);
  const line = (text: string, step: 1 | 2 | 3, ms = 1000): LoadingLine => ({ text, step, ms });

  if (!progress) return [line(pick(rand, START, 1)[0], 1)];

  if (progress.stage === "understanding") {
    return pick(rand, UNDERSTANDING, 2).map((t) => line(t, 1, 1200));
  }

  if (progress.stage === "searching") {
    const lines: LoadingLine[] = [];
    if (progress.query) lines.push(line(`Searching for ${quoted(progress.query)}`, 1, 1400));
    // Searches take 2–5 seconds, so the lines most specific to this search go first.
    const extras = [
      ...(progress.more ? pick(rand, FINDING_MORE, 1) : []),
      ...pick(rand, progress.scope === "academic" ? FINDING_ACADEMIC : FINDING, 2),
      ...(progress.scope !== "everything" ? pick(rand, FINDING_FILTERED, 1) : []),
      ...pick(rand, FINDING.filter((t) => !lines.some((l) => l.text === t)), 2),
    ];
    // De-duplicate while keeping order.
    for (const t of extras) if (!lines.some((l) => l.text === t)) lines.push(line(t, 1));
    return lines;
  }

  const pages = `${progress.pages} page${progress.pages === 1 ? "" : "s"}`;
  const verbs = pick(rand, READ_VERBS, READ_VERBS.length);
  // Answers usually land 6–10 seconds after this point, so the site list is
  // kept short and quick, with a comparing line mixed in, or the varied
  // lines after it would rarely get a turn.
  const sites = progress.sites.slice(0, 5).map((site, i) => line(`${verbs[i % verbs.length]} ${site}`, 2, 800));
  const [early, late] = pick(rand, ANALYSING, 2);
  const compareEarly = line(early, 2, 1200);
  const compareLate = line(late, 3, 1200);
  return [
    line(`${pick(rand, FOUND, 1)[0]} ${pages}`, 2, 900),
    ...sites.slice(0, 2),
    compareEarly,
    ...sites.slice(2),
    compareLate,
    ...pick(rand, WRITING, 2).map((t) => line(t, 3, 1600)),
    ...pick(rand, CITING, 2).map((t) => line(t, 3, 1600)),
    line(pick(rand, FINISHING, 1)[0], 3, 0),
  ];
}

function TurnLoading({ progress, seed }: { progress?: ResearchProgress; seed: string }) {
  // Remounting per stage restarts the sequence when the server moves on.
  return <LoadingTicker key={progress?.stage ?? "start"} lines={loadingLines(progress, seed)} />;
}

function LoadingTicker({ lines }: { lines: LoadingLine[] }) {
  const [index, setIndex] = useState(0);
  const i = Math.min(index, lines.length - 1);
  const line = lines[i];

  // Primitive deps only: `lines` is rebuilt on every parent render, and
  // depending on it would restart the timer each time and stall the ticker.
  const last = i >= lines.length - 1;
  const ms = line.ms;
  useEffect(() => {
    if (last) return;
    const timer = setTimeout(() => setIndex((n) => n + 1), ms);
    return () => clearTimeout(timer);
  }, [i, last, ms]);

  // Finding fills the first third of the bar; reading and writing the rest.
  const within = lines.length > 1 ? i / (lines.length - 1) : 0;
  const finding = lines[0].step === 1;
  const bar = Math.round(finding ? 8 + within * 27 : 40 + within * 52);

  return (
    <div aria-live="polite" aria-busy="true" style={{ marginBottom: 34 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <span
          className="section-label"
          style={{
            color: "var(--color-mark)",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <span key={line.text} className="label-swap">
            {line.text}
          </span>
        </span>
        <span className="mono-meta" style={{ flex: "none", color: "var(--meta-dim)" }}>
          step {line.step} of 3
        </span>
      </div>

      <div style={{ height: 2, background: "var(--rule-soft)", marginBottom: 20 }}>
        <div
          className="animate-pulse-soft"
          style={{
            height: 2,
            width: `${bar}%`,
            background: "var(--color-ink)",
            transition: "width 900ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>

      {/* Skeleton lines sit in the prose measure, so the answer lands where the
          placeholder promised instead of jumping the page. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: "68ch" }}>
        {["96%", "88%", "92%", "54%"].map((width, i) => (
          <div
            key={width}
            className="animate-pulse-soft"
            style={{
              height: 12,
              width,
              background: "var(--rule-soft)",
              borderRadius: "var(--radius-tight)",
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TurnError({ turn, onRetry }: { turn: Turn; onRetry: () => void }) {
  // The quota case gets its own explanation — it is the one students will hit.
  const isQuota = /quota|rate limit|429/i.test(turn.error ?? "");

  return (
    <div
      style={{
        marginBottom: 34,
        paddingLeft: 16,
        borderLeft: "1px solid var(--color-mark)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {isQuota && <span className="badge badge-weak">429</span>}
        <span className="title" style={{ fontSize: "1.125rem" }}>
          {isQuota ? "Today's quota for this model is used up" : "Couldn't finish that search"}
        </span>
      </div>

      <p
        style={{
          margin: "0 0 12px",
          font: "400 0.875rem/1.62 var(--font-serif)",
          color: "var(--body-secondary)",
          maxWidth: "62ch",
        }}
      >
        {turn.error}
      </p>

      {isQuota && (
        <p
          style={{
            margin: "0 0 14px",
            font: "400 0.875rem/1.62 var(--font-serif)",
            color: "var(--body-secondary)",
            maxWidth: "62ch",
          }}
        >
          The free tier counts requests per day <em>per model</em>, so switching models in{" "}
          <code style={{ font: "400 0.75rem/1 var(--font-mono)" }}>.env.local</code> gives a fresh allowance.
          This thread and its citations are untouched.
        </p>
      )}

      <button type="button" onClick={onRetry} className="btn-quiet">
        Try again
      </button>
    </div>
  );
}
