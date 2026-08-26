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
    <button type="button" onClick={copy} className="ink-action" aria-live="polite">
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

/**
 * One source, set as an entry in a ruled list rather than a card.
 *
 * The reference number sits in its own margin column at display size, which is
 * how a numbered reference actually reads on a printed page — and it gives the
 * eye one hard-left column to run down when scanning a dozen of these.
 */
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
   * Which question this source came from. Shown only where the entry has been
   * lifted out of its question group — otherwise the group divider says it.
   */
  fromQuestion?: number;
}) {
  const runs = formatCitation(source, style);
  const citationText = runsToText(runs);
  const inText = inTextCitation(source, style);

  const year = source.publishedDate?.slice(0, 4) ?? null;
  const host = hostOf(source.url);
  // Missing metadata is surfaced, not hidden — it is the cue to check the page.
  const missingDate = !source.publishedDate;
  const missingAuthor = source.authors.length === 0;
  // An entry with neither renders collapsed: there is not enough to cite.
  // The same predicate drives the sort, so collapsed entries land together.
  const partial = isIncomplete(source);

  return (
    <li ref={cardRef} className={`source-entry${flashing ? " is-flashing" : ""}`}>
      <span className="source-entry-num" aria-hidden="true">
        {source.number}
      </span>

      <div style={{ minWidth: 0 }}>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            font: `400 ${partial ? "0.9375rem" : "1.0625rem"}/1.35 var(--font-serif)`,
            color: partial ? "var(--body-secondary)" : "var(--color-ink)",
            textDecoration: "none",
            textWrap: "pretty",
          }}
        >
          {source.title}
        </a>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            margin: "6px 0 0",
          }}
        >
          <span className="mono-meta">{year ? `${host} · ${year}` : host}</span>
          {missingDate && <span className="badge badge-missing">no date</span>}
          {missingAuthor && <span className="badge badge-missing">no author</span>}
          {!partial && source.reliability === "high" && <span className="badge badge-strong">strong</span>}
          {!partial && source.reliability === "low" && <span className="badge badge-weak">verify</span>}
        </div>

        {!partial && (
          <>
            {source.summary && (
              <p
                style={{
                  margin: "9px 0 0",
                  font: "400 0.875rem/1.62 var(--font-serif)",
                  color: "var(--body-secondary)",
                  textWrap: "pretty",
                }}
              >
                {source.summary}
              </p>
            )}

            <div className="citation-block" style={{ marginTop: 11 }}>
              {runs.map((run, i) => (run.italic ? <i key={i}>{run.text}</i> : <span key={i}>{run.text}</span>))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
                margin: "10px 0 0",
              }}
            >
              <span className="mono-meta">{inText}</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 14 }}>
                <CopyButton value={citationText} label="Copy entry" />
                <CopyButton value={inText} label="Copy in-text" />
              </span>
            </div>
          </>
        )}

        {fromQuestion !== undefined && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: "1px solid var(--rule-soft)",
              font: "400 var(--step-label)/1 var(--font-mono)",
              color: "var(--meta-dim)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            From question {fromQuestion}
          </div>
        )}
      </div>
    </li>
  );
}
