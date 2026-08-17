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
    <div style={{ width: "100%", maxWidth: 680 }}>
      {/* The whole field lights up on focus, not just the inner textarea —
          the border is the control as far as the eye is concerned. */}
      <div
        className="composer-field"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          background: "var(--color-paper)",
          border: "1px solid rgba(0,0,0,.13)",
          borderRadius: 9,
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
              : "Ask a follow-up — “can I have more sources?”"
          }
          style={{
            flex: 1,
            minWidth: 0,
            resize: "none",
            border: 0,
            outline: "none",
            background: "transparent",
            font: "400 14px/1.4 var(--font-sans)",
            color: "var(--color-ink)",
          }}
        />

        {variant === "docked" && (
          <span
            style={{ flex: "none", font: "400 10px/1 var(--font-mono)", color: "rgba(0,0,0,.32)" }}
            title="Follow-ups are answered with the last four turns as context."
          >
            last 4 turns
          </span>
        )}

        <button
          type="button"
          onClick={() => submit()}
          disabled={busy || !draft.trim()}
          style={{
            flex: "none",
            padding: "8px 14px",
            background: "var(--color-teal)",
            color: "#fff",
            borderRadius: 6,
            font: "500 12px/1 var(--font-sans)",
            border: 0,
            cursor: busy || !draft.trim() ? "default" : "pointer",
            opacity: busy || !draft.trim() ? 0.45 : 1,
          }}
        >
          <span key={busy ? "busy" : "idle"} className="label-swap">
            {busy ? "Reading…" : "Ask"}
          </span>
        </button>
      </div>

      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
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
                font: "400 11px/1.35 var(--font-sans)",
                color: "var(--body-secondary)",
                background: "var(--color-paper)",
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
