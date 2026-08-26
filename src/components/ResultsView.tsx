"use client";

import { Fragment } from "react";
import type { ResearchResult } from "@/lib/types";

/**
 * Render "[2]" and "[2, 4]" markers in model prose as superscript buttons
 * that point into the sources rail.
 *
 * `numberMap` translates the per-turn source number the model wrote into the
 * thread-wide number the rail displays. A marker that doesn't map is dropped
 * rather than guessed at.
 */
function WithMarkers({
  text,
  numberMap,
  onMarkerClick,
}: {
  text: string;
  numberMap: Map<number, number>;
  onMarkerClick: (threadNumber: number) => void;
}) {
  const pieces = text.split(/(\[\d+(?:,\s*\d+)*\])/g);

  return (
    <>
      {pieces.map((piece, i) => {
        const match = /^\[(\d+(?:,\s*\d+)*)\]$/.exec(piece);
        if (!match) return <Fragment key={i}>{piece}</Fragment>;

        const resolved = match[1]
          .split(",")
          .map((n) => numberMap.get(Number(n.trim())))
          .filter((n): n is number => typeof n === "number");

        const unique = [...new Set(resolved)].sort((a, b) => a - b);
        if (unique.length === 0) return null;

        // Several sources share one <sup>, joined by commas: 2,4
        return (
          <sup key={i} className="marker" style={{ cursor: "default" }}>
            {unique.map((n, j) => (
              <Fragment key={n}>
                {j > 0 && ","}
                <button
                  type="button"
                  className="marker"
                  style={{ verticalAlign: "baseline", padding: 0 }}
                  onClick={() => onMarkerClick(n)}
                  title={`Source ${n} — show in the rail`}
                >
                  {n}
                </button>
              </Fragment>
            ))}
          </sup>
        );
      })}
    </>
  );
}

export default function ResultsView({
  result,
  numberMap,
  onMarkerClick,
  isFirst,
}: {
  result: ResearchResult;
  numberMap: Map<number, number>;
  onMarkerClick: (threadNumber: number) => void;
  /** The opening answer reads slightly larger than follow-ups. */
  isFirst: boolean;
}) {
  // The opening answer is set one step larger than follow-ups: it carries the
  // thread, and the difference is what stops a long thread reading as a flat
  // wall of identical paragraphs.
  const proseSize = isFirst ? "1.0625rem" : "1rem";

  // Shown by both branches below, so it lives outside them.
  function ScopeFallbackNote() {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "11px 13px",
          background: "var(--mark-tint)",
          borderLeft: "1px solid var(--color-mark)",
          marginBottom: 20,
        }}
      >
        <span className="badge badge-weak" style={{ flex: "none" }}>
          scope fell back
        </span>
        <span style={{ font: "400 0.875rem/1.62 var(--font-serif)", color: "var(--color-ink-prose)", maxWidth: "62ch" }}>
          Too few university and government pages matched, so the search widened to the general web. Check the
          metadata on each source before citing.
        </span>
      </div>
    );
  }

  // A "more sources" turn deliberately carries no prose. Rather than render a
  // stack of empty sections, it gets its own compact confirmation.
  if (result.mode === "sources") {
    return (
      <div className="answer-in">
        {result.scopeFellBack && <ScopeFallbackNote />}
        <p
          style={{
            font: "400 0.9375rem/1.66 var(--font-serif)",
            color: "var(--body-secondary)",
            margin: 0,
          }}
        >
          Added <strong style={{ color: "var(--color-ink)" }}>{result.sources.length}</strong> more source
          {result.sources.length === 1 ? "" : "s"} on this topic
          {result.searchQuery ? (
            <>
              {" "}
              — searched for <span className="mono-meta">{result.searchQuery}</span>
            </>
          ) : null}
          . They&apos;re numbered {result.sources[0]?.number ?? "?"}
          {result.sources.length > 1 ? `–${result.sources[result.sources.length - 1].number}` : ""} in the
          Sources panel, with citations in your chosen style.
        </p>
        <p
          style={{
            font: "400 0.8125rem/1.6 var(--font-sans)",
            color: "var(--meta)",
            margin: "10px 0 0",
          }}
        >
          Anything already cited earlier in this thread was filtered out, so these are new.
        </p>
      </div>
    );
  }

  return (
    // Mounts when the answer lands, so the rise doubles as the arrival.
    <div className="answer-in">
      {result.scopeFellBack && <ScopeFallbackNote />}

      {result.overview.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="prose" style={{ margin: "0 0 22px", fontSize: proseSize }}>
          <WithMarkers text={para} numberMap={numberMap} onMarkerClick={onMarkerClick} />
        </p>
      ))}

      {result.keyPoints.length > 0 && (
        <>
          <div className="section-label" style={{ margin: "0 0 12px" }}>
            Key points
          </div>
          <ul
            style={{
              margin: "0 0 24px",
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 11,
            }}
          >
            {/*
              Numbered in the margin rather than bulleted, matching how source
              entries are set. One numeral column runs down the whole page.
            */}
            {result.keyPoints.map((point, i) => (
              <li key={i} style={{ display: "grid", gridTemplateColumns: "2.1rem 1fr", columnGap: "0.5rem" }}>
                <span
                  aria-hidden="true"
                  className="tabular"
                  style={{
                    font: "400 var(--step-label)/1.7 var(--font-mono)",
                    color: "var(--meta-dim)",
                    textAlign: "right",
                    paddingRight: 2,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    font: "400 0.9375rem/1.66 var(--font-serif)",
                    color: "var(--color-ink-soft)",
                    maxWidth: "64ch",
                    textWrap: "pretty",
                  }}
                >
                  <WithMarkers text={point} numberMap={numberMap} onMarkerClick={onMarkerClick} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {result.caveats.map((caveat, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 11,
            padding: "13px 15px",
            background: "var(--mark-tint)",
            borderLeft: "1px solid var(--color-mark)",
            marginBottom: i === result.caveats.length - 1 ? 30 : 10,
          }}
        >
          <span style={{ font: "400 0.9375rem/1.66 var(--font-serif)", color: "var(--color-ink-prose)", maxWidth: "62ch", textWrap: "pretty" }}>
            <WithMarkers text={caveat} numberMap={numberMap} onMarkerClick={onMarkerClick} />
          </span>
        </div>
      ))}
    </div>
  );
}
