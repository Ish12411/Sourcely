"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SourceCard from "./SourceCard";
import { STYLES, bibliographyText, isNumericStyle } from "@/lib/citations";
import {
  groupByQuestion,
  groupLabel,
  partitionByCitability,
  type RailSource,
} from "@/lib/threadSources";
import type { Scope, StyleId } from "@/lib/types";

const SCOPES: Array<{ id: Scope; label: string }> = [
  { id: "balanced", label: "Balanced" },
  { id: "academic", label: "Academic & official" },
  { id: "everything", label: "Everything" },
];

const STYLE_GROUPS = Array.from(new Set(STYLES.map((s) => s.group)));

export type FocusRequest = { number: number; nonce: number };

export default function SourcesModal({
  rail,
  style,
  scope,
  onStyleChange,
  onScopeChange,
  focusRequest,
  onClose,
}: {
  rail: RailSource[];
  style: StyleId;
  scope: Scope;
  onStyleChange: (style: StyleId) => void;
  onScopeChange: (scope: Scope) => void;
  focusRequest: FocusRequest | null;
  onClose: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const cards = useRef<Map<number, HTMLLIElement>>(new Map());
  const [flashing, setFlashing] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Citable sources stay grouped by question; everything that can't produce a
  // reference entry is pulled out of those groups entirely and shown once, at
  // the very bottom.
  const { citable, incomplete } = useMemo(() => partitionByCitability(rail), [rail]);
  const groups = useMemo(() => groupByQuestion(citable), [citable]);

  // Cards in the bottom block have lost their group divider, so they carry
  // their own origin label — but only once the thread has more than one
  // question, otherwise "Question 1" on every card is just noise.
  const multipleQuestions = useMemo(
    () => new Set(rail.map((r) => r.questionNumber)).size > 1,
    [rail]
  );
  const sources = useMemo(() => rail.map((r) => r.source), [rail]);
  const numeric = isNumericStyle(style);

  // Esc closes, and the page behind must not scroll while this is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      // Remove rather than restore a captured value: if the effect re-runs
      // (React re-invokes effects in dev), the "previous" value it captured is
      // the lock this component itself set, and the page stays stuck.
      document.body.style.removeProperty("overflow");
    };
  }, [onClose]);

  // Scroll to the card a prose marker pointed at, and flash it.
  useEffect(() => {
    if (!focusRequest) return;
    const el = cards.current.get(focusRequest.number);
    const box = scroller.current;
    if (!el || !box) return;

    // Deliberately not scrollIntoView — that walks every scrollable ancestor.
    box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 16;

    setFlashing(focusRequest.number);
    const timer = setTimeout(() => setFlashing(null), 700);
    return () => clearTimeout(timer);
  }, [focusRequest]);

  async function copy(kind: "all" | "bibtex") {
    const text = bibliographyText(sources, kind === "bibtex" ? "bibtex" : style);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div
      className="backdrop-in no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Sources and citations"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(26,26,25,.34)",
        backdropFilter: "blur(2px)",
        padding: 24,
      }}
    >
      <div
        ref={panel}
        className="dialog-in"
        style={{
          // Two thirds of the viewport, centred, with clamps so it stays
          // usable on very small and very large screens.
          width: "min(66.67vw, 1180px)",
          height: "min(66.67vh, 860px)",
          minWidth: "min(100%, 340px)",
          minHeight: 360,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-paper)",
          borderRadius: 12,
          boxShadow: "0 24px 70px rgba(0,0,0,.28)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            flex: "none",
            padding: "18px 24px",
            borderBottom: "1px solid rgba(0,0,0,.1)",
            background: "var(--color-paper-sunk)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="eyebrow" style={{ color: "var(--meta)" }}>
              Sources &amp; citations
            </span>
            <span className="mono-meta" style={{ color: "var(--meta-dim)" }}>
              {rail.length} in this thread
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sources"
              autoFocus
              style={{
                marginLeft: "auto",
                width: 28,
                height: 28,
                borderRadius: 6,
                border: 0,
                background: "transparent",
                cursor: "pointer",
                font: "400 14px/1 var(--font-mono)",
                color: "var(--meta)",
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Select label="STYLE" value={style} onChange={(v) => onStyleChange(v as StyleId)}>
              {STYLE_GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {STYLES.filter((s) => s.group === group).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>

            <Select label="SCOPE" value={scope} onChange={(v) => onScopeChange(v as Scope)}>
              {SCOPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>

            <span style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: "auto" }}>
              <button type="button" className="teal-action" onClick={() => copy("all")} disabled={!rail.length}>
                <span key={copied === "all" ? "y" : "n"} className="label-swap">
                  {copied === "all" ? "Copied" : numeric ? "Copy all, in order" : "Copy all, alphabetised"}
                </span>
              </button>
              <button type="button" className="teal-action" onClick={() => copy("bibtex")} disabled={!rail.length}>
                <span key={copied === "bibtex" ? "y" : "n"} className="label-swap">
                  {copied === "bibtex" ? "Copied" : "BibTeX"}
                </span>
              </button>
              <span
                style={{ font: "400 10px/1 var(--font-mono)", color: "rgba(0,0,0,.35)" }}
                title="Restyling re-renders from stored metadata — no API call."
              >
                no extra quota
              </span>
            </span>
          </div>
        </header>

        <div ref={scroller} style={{ flex: 1, overflowY: "auto", padding: "20px 24px 28px" }}>
          {rail.length === 0 && (
            <p style={{ font: "400 13px/1.6 var(--font-sans)", color: "var(--body-secondary)" }}>
              Sources appear here as soon as the first answer lands.
            </p>
          )}

          {groups.map((group, groupIndex) => (
            <div key={group[0].questionNumber}>
              {groupIndex > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "16px 2px 12px",
                    borderTop: "1px dashed rgba(0,0,0,.16)",
                    marginTop: 18,
                  }}
                >
                  <span className="mono-meta" style={{ color: "rgba(0,0,0,.42)" }}>
                    {groupLabel(group)}
                  </span>
                </div>
              )}

              {/* The extra width is the point of the overlay — two columns of
                  cards once there's room, one when there isn't. */}
              <ul
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                  gap: 14,
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  alignItems: "start",
                }}
              >
                {group.map((entry) => (
                  <SourceCard
                    key={entry.threadNumber}
                    source={entry.source}
                    style={style}
                    flashing={flashing === entry.threadNumber}
                    cardRef={(el) => {
                      if (el) cards.current.set(entry.threadNumber, el);
                      else cards.current.delete(entry.threadNumber);
                    }}
                  />
                ))}
              </ul>
            </div>
          ))}

          {incomplete.length > 0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 9,
                  flexWrap: "wrap",
                  padding: "16px 2px 12px",
                  borderTop: "1px dashed rgba(0,0,0,.16)",
                  marginTop: groups.length ? 22 : 0,
                }}
              >
                <span className="eyebrow" style={{ color: "var(--color-amber)" }}>
                  Not enough detail to cite
                </span>
                <span className="mono-meta" style={{ color: "rgba(0,0,0,.42)" }}>
                  {incomplete.length} source{incomplete.length === 1 ? "" : "s"} · no author and no date on the page
                </span>
              </div>

              <ul
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                  gap: 14,
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  alignItems: "start",
                }}
              >
                {incomplete.map((entry) => (
                  <SourceCard
                    key={entry.threadNumber}
                    source={entry.source}
                    style={style}
                    flashing={flashing === entry.threadNumber}
                    fromQuestion={multipleQuestions ? entry.questionNumber : undefined}
                    cardRef={(el) => {
                      if (el) cards.current.set(entry.threadNumber, el);
                      else cards.current.delete(entry.threadNumber);
                    }}
                  />
                ))}
              </ul>

              <p
                style={{
                  margin: "12px 2px 0",
                  font: "400 11.5px/1.6 var(--font-sans)",
                  color: "var(--body-secondary)",
                }}
              >
                These pages don&apos;t state an author or a publication date, so no complete reference entry can be
                built from them. Open each one and check the page itself before citing it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "8px 10px",
        border: "1px solid var(--control-border)",
        borderRadius: 6,
        background: "var(--color-paper)",
      }}
    >
      <span style={{ font: "400 9.5px/1 var(--font-mono)", color: "rgba(0,0,0,.42)", flex: "none" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        style={{
          minWidth: 0,
          border: 0,
          background: "transparent",
          appearance: "none",
          font: "500 11.5px/1 var(--font-sans)",
          color: "var(--color-ink)",
          outline: "none",
          cursor: "pointer",
          paddingRight: 4,
        }}
      >
        {children}
      </select>
      <span aria-hidden="true" style={{ color: "rgba(0,0,0,.35)", flex: "none" }}>
        ▾
      </span>
    </label>
  );
}
