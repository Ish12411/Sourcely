"use client";

import ResultsView from "./ResultsView";
import type { Turn } from "@/lib/types";

export default function Thread({
  turns,
  numberMaps,
  onMarkerClick,
  onRetry,
  maxSources,
}: {
  turns: Turn[];
  /** turn id -> (per-turn source number -> thread-wide number) */
  numberMaps: Map<string, Map<number, number>>;
  onMarkerClick: (threadNumber: number) => void;
  onRetry: (turnId: string) => void;
  maxSources: number;
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

          {turn.status === "loading" && <TurnLoading maxSources={maxSources} />}

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

function TurnLoading({ maxSources }: { maxSources: number }) {
  return (
    <div aria-live="polite" aria-busy="true" style={{ marginBottom: 34 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <span className="section-label" style={{ color: "var(--color-mark)" }}>
          Reading {maxSources} pages
        </span>
        <span className="mono-meta" style={{ marginLeft: "auto", color: "var(--meta-dim)" }}>
          searched · reading · citing
        </span>
      </div>

      <div style={{ height: 2, background: "var(--rule-soft)", marginBottom: 20 }}>
        <div className="animate-pulse-soft" style={{ height: 2, width: "45%", background: "var(--color-ink)" }} />
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
