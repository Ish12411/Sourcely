"use client";

import { useEffect, useState } from "react";

/**
 * Asked once per account, before the first question is sent anywhere.
 *
 * App Store Review Guideline 5.1.2(i): an app must say clearly when personal
 * data goes to a third party — third-party AI included — and get explicit
 * permission first. A question is personal data in the plain sense: people
 * type what they're working on. So this names both services, says exactly what
 * each receives and what Google may do with it, and asks for a yes.
 *
 * "Not now" is a real choice. Saved threads stay readable; only asking a new
 * question needs agreement, because it can't be answered without sending it.
 * /api/research enforces the same rule on the server.
 */
export default function AiConsentDialog({
  onAgree,
  onDecline,
}: {
  onAgree: () => Promise<{ error?: string }>;
  onDecline: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onDecline();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onDecline]);

  async function agree() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error } = await onAgree();
    if (error) {
      setError(error);
      setBusy(false);
    }
    // On success the parent unmounts this dialog.
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-consent-title"
      aria-describedby="ai-consent-body"
      className="backdrop-in"
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
          maxWidth: 460,
          // Scrolls rather than overflows on a phone held sideways.
          maxHeight: "100%",
          overflowY: "auto",
          padding: 22,
          background: "var(--color-paper)",
          borderRadius: "var(--radius-overlay)",
          boxShadow: "0 12px 40px var(--shadow-lifted)",
        }}
      >
        <h2 id="ai-consent-title" className="title" style={{ fontSize: "1.25rem" }}>
          Before your first question
        </h2>

        <div id="ai-consent-body" style={{ font: "400 0.875rem/1.62 var(--font-serif)", color: "var(--body-secondary)" }}>
          <p style={{ margin: "12px 0 0" }}>To answer a question, Sourcely sends it to two outside services:</p>

          <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
            <li>
              <strong style={{ color: "var(--color-ink)" }}>Tavily</strong>, a search engine, receives your question to
              find sources.
            </li>
            <li>
              <strong style={{ color: "var(--color-ink)" }}>Google Gemini</strong>, an AI model, receives your question,
              earlier questions in the same thread, and the text of the pages found, and writes the answer.
            </li>
          </ul>

          <p style={{ margin: "12px 0 0" }}>
            Google may use what it receives to improve its products, and people at Google may read it.{" "}
            <strong style={{ color: "var(--color-ink)" }}>
              Don&apos;t include personal or sensitive information in your questions.
            </strong>{" "}
            Your email address and account details are never sent to either service.
          </p>

          <p style={{ margin: "12px 0 0" }}>
            <a href="/privacy" style={{ color: "var(--color-ink)" }}>
              Read the privacy policy
            </a>
          </p>
        </div>

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
          <button type="button" className="btn-quiet" onClick={onDecline} disabled={busy}>
            Not now
          </button>
          <button type="button" className="btn-primary" onClick={() => void agree()} disabled={busy} autoFocus>
            {busy ? "Saving…" : "Agree and continue"}
          </button>
        </div>

        <p className="mono-meta" style={{ margin: "14px 0 0", color: "var(--meta-dim)" }}>
          Without agreeing you can still read your saved threads, but not ask new questions.
        </p>
      </div>
    </div>
  );
}
