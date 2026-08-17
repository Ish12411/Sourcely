"use client";

import { useState } from "react";
import { formatCitation, inTextCitation, runsToText } from "@/lib/citations";
import { isIncomplete } from "@/lib/threadSources";
import type { Source, StyleId } from "@/lib/types";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className="teal-action" aria-live="polite">
      {/* Keyed so the label remounts and replays its rise on each copy. */}
      <span key={copied ? "copied" : "idle"} className="label-swap">
        {copied ? "Copied" : label}
      </span>
    </button>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function SourceCard({
  source,
  style,
  flashing,
  cardRef,
  fromQuestion,
}: {
  source: Source;
  style: StyleId;
  /** True briefly after a prose marker points here. */
  flashing: boolean;
  cardRef: (el: HTMLLIElement | null) => void;
  /**
   * Which question this source came from. Shown only where the card has been
   * lifted out of its question group — otherwise the group divider says it.
   */
  fromQuestion?: number;
}) {
  const runs = formatCitation(source, style);
  const citationText = runsToText(runs);
  const inText = inTextCitation(source, style);

  const year = source.publishedDate?.slice(0, 4) ?? null;
  const host = hostOf(source.url);
  // Missing metadata is surfaced, not hidden — it's the cue to check the page.
  const missingDate = !source.publishedDate;
  const missingAuthor = source.authors.length === 0;
  // A card with neither renders collapsed: there isn't enough to cite properly.
  // Same predicate drives the sort, so collapsed cards always land together.
  const partial = isIncomplete(source);

  return (
    <li
      ref={cardRef}
      className={`source-card rise-in${flashing ? " is-flashing" : ""}`}
      style={partial ? { boxShadow: "none" } : undefined}
    >
      <div style={{ display: "flex", gap: 10, marginBottom: partial ? 0 : 6 }}>
        <span
          style={{
            flex: "none",
            font: "500 11.5px/1.5 var(--font-mono)",
            color: partial ? "rgba(0,0,0,.4)" : "var(--color-amber)",
          }}
        >
          {source.number}
        </span>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            font: `${partial ? 400 : 500} 13.5px/1.45 var(--font-sans)`,
            color: partial ? "rgba(0,0,0,.6)" : "var(--color-ink)",
            textDecoration: "none",
          }}
        >
          {source.title}
        </a>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          margin: partial ? "6px 0 0 21px" : "0 0 8px 21px",
        }}
      >
        <span className="mono-meta">{year ? `${host} · ${year}` : host}</span>
        {missingDate && <span className="badge badge-warn">NO DATE FOUND</span>}
        {missingAuthor && <span className="badge badge-warn">NO AUTHOR FOUND</span>}
        {!partial && source.reliability === "high" && <span className="badge badge-high">HIGH</span>}
      </div>

      {!partial && (
        <>
          {source.summary && (
            <p
              style={{
                margin: "0 0 9px 21px",
                font: "400 12.5px/1.6 var(--font-sans)",
                color: "var(--body-secondary)",
              }}
            >
              {source.summary}
            </p>
          )}

          <div className="citation-block" style={{ marginLeft: 21 }}>
            {runs.map((run, i) => (run.italic ? <i key={i}>{run.text}</i> : <span key={i}>{run.text}</span>))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              margin: "9px 0 0 21px",
            }}
          >
            <span style={{ font: "400 11px/1 var(--font-mono)", color: "rgba(0,0,0,.5)" }}>{inText}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
              <CopyButton value={citationText} label="Copy entry" />
              <CopyButton value={inText} label="Copy in-text" />
            </span>
          </div>
        </>
      )}

      {fromQuestion !== undefined && (
        <div
          style={{
            marginTop: partial ? 9 : 11,
            marginLeft: 21,
            paddingTop: 8,
            borderTop: "1px solid var(--hairline-soft)",
            font: "400 10px/1 var(--font-mono)",
            color: "var(--meta-dim)",
          }}
        >
          Question {fromQuestion}
        </div>
      )}
    </li>
  );
}
