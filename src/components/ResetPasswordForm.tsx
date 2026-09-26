"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Set a new password. Reached from the reset email (via /auth/confirm, which
 * has already established the session) or directly by a signed-in person who
 * wants to change theirs.
 *
 * The reset email opens in Mail or Safari, not in the app. So on success this
 * says plainly where to go next, rather than dropping the person into the web
 * version of Sourcely in the wrong place.
 */
export default function ResetPasswordForm() {
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const tooShort = password.length > 0 && password.length < 6;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= 6 && confirm === password && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      const m = error.message.toLowerCase();
      setError(
        m.includes("different from the old")
          ? "That's your current password. Choose a new one."
          : m.includes("session")
            ? "This reset link has expired. Request a new one from the sign-in page."
            : error.message
      );
      return;
    }
    setDone(true);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-paper)",
        padding: "calc(32px + var(--safe-top)) max(20px, var(--safe-right)) calc(32px + var(--safe-bottom)) max(20px, var(--safe-left))",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ font: "400 1.75rem/1 var(--font-display)", letterSpacing: "-0.02em" }}>
          Sourcely
          <sup style={{ font: "500 0.6875rem/1 var(--font-mono)", color: "var(--color-mark)", verticalAlign: "super" }}>
            1
          </sup>
        </div>

        {done ? (
          <div role="status">
            <h1 className="title" style={{ marginTop: 22 }}>
              Password set
            </h1>
            <p className="prose" style={{ margin: "12px 0 0" }}>
              {email ? (
                <>
                  You can now sign in as <strong style={{ color: "var(--color-ink)" }}>{email}</strong> with this
                  password.
                </>
              ) : (
                "You can now sign in with this password."
              )}
            </p>
            <p className="prose" style={{ margin: "12px 0 0" }}>
              <strong style={{ color: "var(--color-ink)" }}>Using the Sourcely app?</strong> Go back to it now and sign
              in there — this page opened in your browser, not the app.
            </p>
            <a href="/" className="btn-quiet" style={{ display: "inline-block", marginTop: 22, textDecoration: "none" }}>
              Or continue on the website
            </a>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 22 }}>
            <h1 className="title">Choose a new password</h1>
            {email && (
              <p className="mono-meta" style={{ margin: "-4px 0 4px" }}>
                for {email}
              </p>
            )}

            <label style={{ display: "block" }}>
              <span className="section-label" style={{ display: "block", marginBottom: 6 }}>
                New password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                autoFocus
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                style={field}
                aria-invalid={tooShort || undefined}
              />
              <span className="mono-meta" style={{ display: "block", marginTop: 6, color: tooShort ? "var(--color-mark-deep)" : "var(--meta-dim)" }}>
                at least 6 characters
              </span>
            </label>

            <label style={{ display: "block" }}>
              <span className="section-label" style={{ display: "block", marginBottom: 6 }}>
                Confirm password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
                style={field}
                aria-invalid={mismatch || undefined}
              />
              {mismatch && (
                <span className="mono-meta" style={{ display: "block", marginTop: 6, color: "var(--color-mark-deep)" }}>
                  doesn&apos;t match
                </span>
              )}
            </label>

            {error && (
              <p
                role="alert"
                style={{
                  margin: 0,
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

            <button type="submit" className="btn-primary" disabled={!canSubmit} style={{ width: "100%", padding: "11px 15px" }}>
              {busy ? "Saving…" : "Set password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

const field: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--color-paper-raised)",
  border: "1px solid var(--control-border)",
  borderRadius: "var(--radius-control)",
  font: "400 0.9375rem/1.4 var(--font-sans)",
  color: "var(--color-ink)",
};
