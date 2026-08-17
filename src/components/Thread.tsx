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
              ? { borderTop: "1px solid rgba(0,0,0,.1)", paddingTop: 22, marginTop: 30 }
              : undefined
          }
        >
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Question {i + 1}
          </div>

          {i === 0 ? (
            <h2
              style={{
                margin: "0 0 20px",
                font: "400 29px/1.26 var(--font-serif)",
                letterSpacing: "-.01em",
                textWrap: "pretty",
              }}
            >
              {turn.question}
            </h2>
          ) : (
            <h3 style={{ margin: "0 0 14px", font: "400 23px/1.3 var(--font-serif)", textWrap: "pretty" }}>
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
    <div aria-live="polite" aria-busy="true" style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span className="eyebrow" style={{ color: "var(--color-teal)" }}>
          Reading {maxSources} pages
        </span>
        <span
          className="mono-meta"
          style={{ marginLeft: "auto", color: "rgba(0,0,0,.42)" }}
        >
          searched · read · citing —
        </span>
      </div>

      <div style={{ height: 2, background: "rgba(0,0,0,.09)", marginBottom: 16 }}>
        <div className="animate-pulse-soft" style={{ height: 2, width: "45%", background: "var(--color-teal)" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {["88%", "96%", "54%"].map((width, i) => (
          <div
            key={width}
            className="animate-pulse-soft"
            style={{
              height: 13,
              width,
              background: "rgba(0,0,0,.075)",
              borderRadius: 2,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TurnError({ turn, onRetry }: { turn: Turn; onRetry: () => void }) {
  // The quota case gets its own explanation — it's the one students will hit.
  const isQuota = /quota|rate limit|429/i.test(turn.error ?? "");

  return (
    <div
      className="source-card"
      style={{ borderColor: "rgba(180,118,26,.4)", boxShadow: "none", marginBottom: 30 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {isQuota && (
          <span
            className="badge"
            style={{ border: "1px solid rgba(180,118,26,.45)", color: "var(--color-amber)" }}
          >
            429
          </span>
        )}
        <span style={{ font: "500 16px/1.3 var(--font-sans)" }}>
          {isQuota ? "Today's quota for this model is used up" : "Couldn't finish that search"}
        </span>
      </div>

      <p style={{ margin: "0 0 12px", font: "400 14px/1.6 var(--font-sans)", color: "var(--body-secondary)" }}>
        {turn.error}
      </p>

      {isQuota && (
        <p style={{ margin: "0 0 12px", font: "400 13px/1.6 var(--font-sans)", color: "var(--body-secondary)" }}>
          The free tier counts requests per day <em>per model</em>, so switching models in{" "}
          <code style={{ font: "400 12px/1 var(--font-mono)" }}>.env.local</code> gives a fresh allowance. This
          thread and its citations are untouched.
        </p>
      )}

      <button
        type="button"
        onClick={onRetry}
        className="outlined"
        style={{ padding: "8px 14px", font: "500 12px/1 var(--font-sans)" }}
      >
        Try again
      </button>
    </div>
  );
}
