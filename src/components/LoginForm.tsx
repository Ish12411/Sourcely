"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, isAuthConfigured } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "forgot";

/**
 * Turn Supabase auth errors into something a student can act on. The raw
 * strings are written for developers and several of them are actively
 * misleading in a UI ("Invalid login credentials" for a typo'd email).
 */
function humanise(message: string, mode: Mode): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    // This is exactly what someone who signed up with Google sees when they
    // try a password — including inside the app, where Google is hidden — so
    // name the way out rather than leaving them to guess.
    return "That email and password don't match an account. If you signed up with Google, use “Forgot password?” to set a password.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "There's already an account with that email. Switch to signing in.";
  }
  if (m.includes("password should be at least")) {
    return "Passwords need to be at least 6 characters.";
  }
  if (m.includes("for security purposes")) {
    return "A link was just sent. Wait a minute before asking for another.";
  }
  if (m.includes("rate limit") || m.includes("over_email_send_rate_limit")) {
    return mode === "forgot"
      ? "Too many emails have gone out in the last hour. Wait an hour and try again."
      : "Too many sign-up emails have gone out in the last hour. Wait an hour and try again, or use Google on the website.";
  }
  if (m.includes("email not confirmed")) {
    return "That account still needs confirming. Check your inbox for the confirmation link.";
  }
  if (m.includes("provider is not enabled")) {
    return "Google sign-in isn't switched on in this project's Supabase settings yet.";
  }
  return message || (mode === "signup" ? "Couldn't create that account." : "Couldn't sign in.");
}

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "email" | "google">(null);
  // /auth/callback and /auth/confirm both send failures back as ?error=...
  // Nothing read it before, so an expired reset link landed here silently.
  const [error, setError] = useState<string | null>(params.get("error"));
  // After an in-app account deletion the dialog lands here with ?deleted=1;
  // saying so plainly confirms the deletion actually went through.
  const [notice, setNotice] = useState<string | null>(
    params.get("deleted") === "1" ? "Your account and all its threads have been deleted." : null
  );

  const configured = isAuthConfigured();

  /**
   * True inside the Natively app shell. Google's OAuth policy forbids sign-in
   * inside an embedded webview ("a developer must not direct a Google OAuth
   * 2.0 authorization request to an embedded user-agent under the developer's
   * control"), so in the app the button would open Google and dead-end on a
   * blocked-request page. Hiding it is better than offering a button that
   * cannot work.
   *
   * Detection mirrors Natively's own SDK: its browserInfo() checks the user
   * agent for "Natively/iOS" or "Natively/Android", and treats the presence of
   * a window.$agent global as a native app. Checked in an effect, because it
   * reads `navigator` and would otherwise mismatch the server-rendered HTML.
   */
  const [inNativeApp, setInNativeApp] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    setInNativeApp(/Natively\/(iOS|Android)/.test(ua) || typeof (window as { $agent?: unknown }).$agent !== "undefined");
  }, []);

  async function withEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy("email");

    try {
      const supabase = createClient();

      if (mode === "forgot") {
        // The link in the email is a token_hash link verified server-side at
        // /auth/confirm (see NATIVELY-SETUP.md for the template). That matters
        // here: the request comes from inside the app, but the email opens in
        // Mail or Safari. The default PKCE link only works in the browser that
        // asked for it, so it would fail every time from the app.
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        // Same message whether or not an account exists, so this form can't be
        // used to find out which emails are registered.
        setNotice(
          "If there's an account for that email, a link to set a new password is on its way. Open it on this device, choose a password, then come back here and sign in."
        );
        setMode("signin");
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // With email confirmation switched off, signUp returns a live session
        // and we go straight in. With it on, there is no session yet.
        if (!data.session) {
          setNotice("Check your email for a confirmation link, then sign in.");
          setMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      // refresh() so the server re-renders with the new session cookie before
      // navigating; push() alone can land on a page that still thinks nobody
      // is signed in.
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(humanise(err instanceof Error ? err.message : String(err), mode));
    } finally {
      setBusy(null);
    }
  }

  async function withGoogle() {
    if (busy) return;
    setError(null);
    setBusy("google");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
      // On success the browser is navigating to Google; leave the button busy.
    } catch (err) {
      setError(humanise(err instanceof Error ? err.message : String(err), mode));
      setBusy(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // max(): 24px normally, but never less than the notch in landscape.
        padding: "max(24px, var(--safe-top)) max(24px, var(--safe-right)) max(24px, var(--safe-bottom)) max(24px, var(--safe-left))",
        background: "var(--color-paper)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ marginBottom: 30 }}>
          <div style={{ font: "400 1.75rem/1 var(--font-display)", letterSpacing: "-0.02em" }}>
            Sourcely
            <sup
              style={{
                font: "500 0.6875rem/1 var(--font-mono)",
                color: "var(--color-mark)",
                verticalAlign: "super",
              }}
            >
              1
            </sup>
          </div>
          <p
            style={{
              margin: "12px 0 0",
              font: "400 0.9375rem/1.6 var(--font-serif)",
              color: "var(--body-secondary)",
              maxWidth: "34ch",
            }}
          >
            {mode === "signin"
              ? "Sign in to reach your threads and the ones shared with you."
              : "Create an account to keep your threads and share them."}
          </p>
        </div>

        {!configured && (
          <div
            style={{
              padding: "12px 14px",
              marginBottom: 20,
              background: "var(--mark-tint)",
              borderLeft: "1px solid var(--color-mark)",
              font: "400 0.8125rem/1.6 var(--font-sans)",
              color: "var(--color-ink-prose)",
            }}
          >
            Sign-in is not configured yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then restart the server.
          </div>
        )}

        {!inNativeApp && (
        <>
        <button
          type="button"
          onClick={withGoogle}
          disabled={!configured || busy !== null}
          className="btn-quiet"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "11px 15px",
          }}
        >
          <GoogleMark />
          <span key={busy === "google" ? "b" : "i"} className="label-swap">
            {busy === "google" ? "Opening Google…" : "Continue with Google"}
          </span>
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "20px 0",
          }}
        >
          <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
          <span className="section-label">or</span>
          <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
        </div>
        </>
        )}

        <form onSubmit={withEmail} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "block" }}>
            <span className="section-label" style={{ display: "block", marginBottom: 6 }}>
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!configured || busy !== null}
              style={fieldStyle}
            />
          </label>

          {mode !== "forgot" && (
          <label style={{ display: "block" }}>
            <span style={{ display: "flex", alignItems: "baseline", marginBottom: 6 }}>
              <span className="section-label">Password</span>
              {mode === "signin" && (
                <button
                  type="button"
                  className="ink-action"
                  style={{ marginLeft: "auto", fontSize: "var(--step-label)" }}
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                    setNotice(null);
                  }}
                >
                  Forgot password?
                </button>
              )}
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!configured || busy !== null}
              style={fieldStyle}
            />
            {mode === "signup" && (
              <span
                className="mono-meta"
                style={{ display: "block", marginTop: 6, color: "var(--meta-dim)" }}
              >
                at least 6 characters
              </span>
            )}
          </label>
          )}

          {mode === "forgot" && (
            <p style={{ margin: 0, font: "400 0.8125rem/1.6 var(--font-sans)", color: "var(--body-secondary)" }}>
              Enter your email and you'll get a link to set a new password. This also works if you signed up with
              Google and never had a password.
            </p>
          )}

          {error && (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: "10px 12px",
                background: "var(--mark-tint)",
                borderLeft: "1px solid var(--color-mark)",
                font: "400 0.8125rem/1.6 var(--font-sans)",
                color: "var(--color-ink-prose)",
              }}
            >
              {error}
            </p>
          )}

          {notice && (
            <p
              role="status"
              style={{
                margin: 0,
                padding: "10px 12px",
                background: "var(--color-paper-sunk)",
                font: "400 0.8125rem/1.6 var(--font-sans)",
                color: "var(--color-ink-prose)",
              }}
            >
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={!configured || busy !== null}
            className="btn-primary"
            style={{ width: "100%", padding: "11px 15px" }}
          >
            <span key={`${mode}-${busy === "email"}`} className="label-swap">
              {busy === "email"
                ? mode === "signup"
                  ? "Creating account…"
                  : mode === "forgot"
                    ? "Sending…"
                    : "Signing in…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Sign in"}
            </span>
          </button>
        </form>

        <p style={{ margin: "18px 0 0", font: "400 0.8125rem/1.6 var(--font-sans)", color: "var(--meta)" }}>
          {mode === "signin" ? "No account yet? " : mode === "forgot" ? "Remembered it? " : "Already have an account? "}
          <button
            type="button"
            className="ink-action"
            style={{ font: "500 0.8125rem/1 var(--font-sans)" }}
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
          >
            {mode === "signin" ? "Create one" : "Back to sign in"}
          </button>
        </p>

        <p style={{ margin: "28px 0 0", font: "400 var(--step-label)/1.5 var(--font-sans)", color: "var(--meta)" }}>
          <a href="/privacy" className="ink-action" style={{ fontSize: "inherit" }}>
            Privacy
          </a>
          {" — what's stored, who handles it, and how to delete it."}
        </p>
      </div>
    </main>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--color-paper-raised)",
  border: "1px solid var(--control-border)",
  borderRadius: "var(--radius-control)",
  font: "400 0.9375rem/1.4 var(--font-sans)",
  color: "var(--color-ink)",
};

/** Google's mark, drawn rather than an emoji or an image request. */
function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true" style={{ flex: "none" }}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
