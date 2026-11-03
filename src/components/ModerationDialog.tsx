"use client";

import { useEffect, useState } from "react";

export type ModerationTarget =
  | { kind: "report"; tabId: string; turnId: string; question: string }
  | { kind: "block"; authorId: string; question: string };

const REASONS: Array<[string, string]> = [
  ["offensive", "Offensive or hateful"],
  ["harassment", "Harassment or bullying"],
  ["sexual", "Sexual content"],
  ["spam", "Spam or nonsense"],
  ["other", "Something else"],
];

/**
 * Report a question, or block the person who asked it (App Store Guideline
 * 1.2). Reports go to the developer for review; the reported question is
 * hidden from the reporter at once. Blocking hides everything that person
 * adds, in every thread, and stops them adding to the blocker's own threads.
 */
export default function ModerationDialog({
  target,
  onReport,
  onBlock,
  onClose,
}: {
  target: ModerationTarget;
  onReport: (reason: string, note: string) => Promise<{ error?: string }>;
  onBlock: () => Promise<{ error?: string }>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("offensive");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const isReport = target.kind === "report";

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error } = isReport ? await onReport(reason, note.trim()) : await onBlock();
    setBusy(false);
    if (error) setError(error);
    else setDone(true);
  }

  const shownQuestion = target.question.length > 140 ? `${target.question.slice(0, 139)}…` : target.question;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="moderation-title"
      className="backdrop-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding:
          "calc(16px + var(--safe-top)) max(16px, var(--safe-right)) calc(16px + var(--safe-bottom)) max(16px, var(--safe-left))",
        background: "var(--scrim)",
      }}
    >
      <div
        className="dialog-in"
        style={{
          width: "100%",
          maxWidth: 440,
          maxHeight: "100%",
          overflowY: "auto",
          padding: 22,
          background: "var(--color-paper)",
          borderRadius: "var(--radius-overlay)",
          boxShadow: "0 12px 40px var(--shadow-lifted)",
        }}
      >
        <h2 id="moderation-title" className="title" style={{ fontSize: "1.25rem" }}>
          {done ? (isReport ? "Report sent" : "Blocked") : isReport ? "Report this question" : "Block this person?"}
        </h2>

        <p
          style={{
            margin: "12px 0 0",
            padding: "10px 12px",
            background: "var(--color-paper-sunk)",
            borderRadius: "var(--radius-tight)",
            font: "400 0.875rem/1.5 var(--font-serif)",
            color: "var(--body-secondary)",
          }}
        >
          “{shownQuestion}”
        </p>

        {done ? (
          <p style={{ margin: "14px 0 0", font: "400 0.875rem/1.6 var(--font-serif)", color: "var(--body-secondary)" }}>
            {isReport
              ? "Thanks. It's hidden for you now, and it will be reviewed within 24 hours. Content that breaks the rules is removed and its author can be blocked from Sourcely."
              : "You won't see anything this person adds to any thread, and they can no longer add to threads you own."}
          </p>
        ) : isReport ? (
          <>
            <fieldset style={{ border: 0, margin: "16px 0 0", padding: 0, display: "grid", gap: 8 }}>
              <legend className="section-label" style={{ marginBottom: 8 }}>
                What's wrong with it?
              </legend>
              {REASONS.map(([value, label]) => (
                <label
                  key={value}
                  style={{ display: "flex", alignItems: "center", gap: 10, font: "400 0.875rem/1.4 var(--font-sans)", cursor: "pointer" }}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    disabled={busy}
                    style={{ width: 18, height: 18, accentColor: "var(--color-ink)" }}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label style={{ display: "block", marginTop: 14 }}>
              <span className="section-label" style={{ display: "block", marginBottom: 6 }}>
                Anything else? (optional)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                rows={3}
                disabled={busy}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--color-paper-raised)",
                  border: "1px solid var(--control-border)",
                  borderRadius: "var(--radius-control)",
                  font: "400 0.9375rem/1.4 var(--font-sans)",
                  color: "var(--color-ink)",
                  resize: "vertical",
                }}
              />
            </label>
          </>
        ) : (
          <p style={{ margin: "14px 0 0", font: "400 0.875rem/1.6 var(--font-serif)", color: "var(--body-secondary)" }}>
            Everything this person adds will be hidden from you, in every thread, and they won&apos;t be able to add to
            threads you own. You can undo this from the sidebar.
          </p>
        )}

        {error && (
          <p
            role="alert"
            style={{
              margin: "14px 0 0",
              padding: "10px 12px",
              background: "var(--mark-tint)",
              borderLeft: "1px solid var(--color-mark)",
              borderRadius: "var(--radius-tight)",
              font: "400 0.8125rem/1.55 var(--font-sans)",
              color: "var(--color-ink-prose)",
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          {done ? (
            <button type="button" className="btn-primary" onClick={onClose} autoFocus>
              Done
            </button>
          ) : (
            <>
              <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void submit()}
                disabled={busy}
                style={isReport ? undefined : { background: "var(--color-mark-deep)", borderColor: "var(--color-mark-deep)" }}
              >
                {busy ? (isReport ? "Sending…" : "Blocking…") : isReport ? "Send report" : "Block"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
