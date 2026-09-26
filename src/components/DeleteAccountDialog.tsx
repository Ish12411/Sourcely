"use client";

import { useEffect, useState } from "react";

/**
 * Permanent account deletion, required of any app with sign-up by App Store
 * Review Guideline 5.1.1(v).
 *
 * Typing DELETE is deliberate friction. This removes every thread the person
 * owns — shared ones included, which is what Apple requires and also means a
 * classmate's shared link stops working — and none of it can be recovered.
 * A single confirm button is too easy to tap by accident on a phone.
 */
export default function DeleteAccountDialog({
  email,
  onClose,
}: {
  email: string | null;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const armed = typed.trim().toUpperCase() === "DELETE";

  async function confirm() {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? `Couldn't delete the account (${res.status}).`);
        setBusy(false);
        return;
      }
      // The account is gone server-side. Clear this device's working copy too,
      // then sign out: the session cookie still names a user who no longer
      // exists, and should not outlive them.
      try {
        window.localStorage.removeItem("sourcely.tabs.v3");
      } catch {
        // Storage unavailable — nothing local to clear.
      }
      await fetch("/auth/signout", { method: "POST" }).catch(() => undefined);
      window.location.assign("/login?deleted=1");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
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
        padding: 16,
        background: "var(--scrim)",
      }}
    >
      <div
        className="dialog-in"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 22,
          background: "var(--color-paper)",
          borderRadius: "var(--radius-overlay)",
          boxShadow: "0 12px 40px var(--shadow-lifted)",
        }}
      >
        <h2 id="delete-account-title" className="title" style={{ fontSize: "1.25rem" }}>
          Delete your account?
        </h2>

        <p
          style={{
            margin: "12px 0 0",
            font: "400 0.875rem/1.62 var(--font-serif)",
            color: "var(--body-secondary)",
          }}
        >
          This permanently deletes {email ? <strong style={{ color: "var(--color-ink)" }}>{email}</strong> : "your account"}{" "}
          and every thread in it, including shared ones — anyone you sent a link to will lose access. It can&apos;t be
          undone.
        </p>

        <label style={{ display: "block", marginTop: 16 }}>
          <span className="section-label" style={{ display: "block", marginBottom: 6 }}>
            Type DELETE to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void confirm();
            }}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            aria-label="Type DELETE to confirm"
            style={{
              width: "100%",
              padding: "11px 12px",
              background: "var(--color-paper-raised)",
              border: "1px solid var(--control-border)",
              borderRadius: "var(--radius-control)",
              font: "500 0.9375rem/1.3 var(--font-mono)",
              letterSpacing: "0.08em",
              color: "var(--color-ink)",
              outline: "none",
            }}
          />
        </label>

        {error && (
          <p
            role="alert"
            style={{
              margin: "12px 0 0",
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

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!armed || busy}
            className="btn-primary"
            // The one place the mark red fills a control: the action destroys data.
            style={{ background: "var(--color-mark-deep)", borderColor: "var(--color-mark-deep)" }}
          >
            {busy ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}
