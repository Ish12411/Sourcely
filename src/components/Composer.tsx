"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type ComposerHandle = { focus: () => void };

type Props = {
  busy: boolean;
  /** Centred and larger on an empty thread; docked in the footer otherwise. */
  variant: "empty" | "docked";
  suggestions: string[];
  onSubmit: (question: string) => void;
};

/**
 * The question field. Style and scope selectors deliberately live in the
 * sources rail now — everything to the right of the reading column is
 * citation machinery, and this is just where you type.
 */
const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { busy, variant, suggestions, onSubmit },
  ref
) {
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }), []);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  function submit(text?: string) {
    const value = (text ?? draft).trim();
    if (!value || busy) return;
    onSubmit(value);
    setDraft("");
  }

  return (
    // Matches the reading column, which widened once the sources rail became
    // an overlay instead of a third column.
    <div style={{ width: "100%", maxWidth: 744 }}>
      {/* The whole field lights up on focus, not just the inner textarea —
          the border is the control as far as the eye is concerned. */}
      <div
        className="composer-field"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "13px 15px",
          background: "var(--color-paper-raised)",
          border: "1px solid var(--control-border)",
          borderRadius: "var(--radius-control)",
        }}
      >
        <textarea
          ref={input}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={500}
          disabled={busy}
          aria-label="Research question"
          placeholder={
            variant === "empty"
              ? "What caused the 1973 oil crisis?"
              : // Short on purpose: the placeholder sizes this auto-growing field,
                // and the long example wrapped it to two lines on a phone. The
                // "more sources" prompt is offered as a chip right below anyway.
                "Ask a follow-up…"
          }
          style={{
            flex: 1,
            minWidth: 0,
            resize: "none",
            border: 0,
            outline: "none",
            background: "transparent",
            font: "400 0.9375rem/1.45 var(--font-serif)",
            color: "var(--color-ink)",
          }}
        />

        {variant === "docked" && (
          <span
            className="composer-context-hint"
            style={{ flex: "none", font: "400 10px/1 var(--font-mono)", color: "var(--meta-dim)" }}
            title="Follow-ups are answered with the last four turns as context."
          >
            last 4 turns
          </span>
        )}

        <button
          type="button"
          onClick={() => submit()}
          disabled={busy || !draft.trim()}
          className="btn-primary"
          style={{ flex: "none" }}
        >
          <span key={busy ? "busy" : "idle"} className="label-swap">
            {busy ? "Reading…" : "Ask"}
          </span>
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="composer-chips" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => submit(s)}
              className="outlined"
              // Model follow-ups run long; keep each chip to a single line and
              // let the tooltip carry the rest rather than eating the page.
              title={s}
              style={{
                padding: "5px 9px",
                font: "400 var(--step-label)/1.35 var(--font-sans)",
                color: "var(--body-secondary)",
                background: "transparent",
                textAlign: "left",
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default Composer;
