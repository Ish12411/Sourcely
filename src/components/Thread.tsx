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

          {turn.status === "loading" && <TurnLoading progress={turn.progress} />}

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

/**
 * Every line is about the step the server has actually reported: following a
 * follow-up, searching for a specific query, or reading specific sites. Within
 * a step the line moves on every second or so, because the slow parts (the
 * search, and reading plus writing in one AI call) give no finer signal of
 * their own. It used to sit on "Reading 8 pages" for the whole wait.
 */
function loadingLines(progress?: ResearchProgress): LoadingLine[] {
  if (!progress) return [{ text: "Starting your search", step: 1, ms: 1200 }];

  if (progress.stage === "understanding") {
    return [
      { text: "Reading your earlier questions", step: 1, ms: 1300 },
      { text: "Working out what you're asking", step: 1, ms: 1300 },
    ];
  }

  if (progress.stage === "searching") {
    const lines: LoadingLine[] = [];
    if (progress.query) lines.push({ text: `Searching for ${quoted(progress.query)}`, step: 1, ms: 1400 });
    lines.push(
      progress.scope === "academic"
        ? { text: "Searching journals, universities and government sites", step: 1, ms: 1300 }
        : { text: "Searching the web", step: 1, ms: 1100 }
    );
    if (progress.scope !== "everything") {
      lines.push({ text: "Skipping homework sites and social media", step: 1, ms: 1200 });
    }
    lines.push(
      progress.more
        ? { text: "Looking for sources you haven't seen yet", step: 1, ms: 1300 }
        : { text: "Ranking the most relevant pages", step: 1, ms: 1300 }
    );
    return lines;
  }

  const pages = `${progress.pages} page${progress.pages === 1 ? "" : "s"}`;
  return [
    { text: `Found ${pages}`, step: 2, ms: 1000 },
    ...progress.sites.map((site): LoadingLine => ({ text: `Reading ${site}`, step: 2, ms: 950 })),
    { text: "Comparing what the sources say", step: 3, ms: 1500 },
    { text: "Writing your answer", step: 3, ms: 2200 },
    { text: "Adding citations", step: 3, ms: 2200 },
    { text: "Almost done", step: 3, ms: 0 },
  ];
}

function TurnLoading({ progress }: { progress?: ResearchProgress }) {
  // Remounting per stage restarts the sequence when the server moves on.
  return <LoadingTicker key={progress?.stage ?? "start"} lines={loadingLines(progress)} />;
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
