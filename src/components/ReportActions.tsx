"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Remove / Ban / Dismiss for one report on the /admin page. */
export default function ReportActions({ id, canBan }: { id: string; canBan: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "remove" | "ban" | "dismiss") {
    if (action === "ban" && !window.confirm("Remove this question and ban its author from Sourcely?")) return;
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data?.error ?? "Couldn't do that.");
      else router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn-quiet" disabled={busy !== null} onClick={() => void act("remove")}>
          {busy === "remove" ? "Removing…" : "Remove question"}
        </button>
        {canBan && (
          <button
            type="button"
            className="btn-primary"
            disabled={busy !== null}
            onClick={() => void act("ban")}
            style={{ background: "var(--color-mark-deep)", borderColor: "var(--color-mark-deep)" }}
          >
            {busy === "ban" ? "Banning…" : "Remove and ban author"}
          </button>
        )}
        <button type="button" className="ink-action" disabled={busy !== null} onClick={() => void act("dismiss")}>
          {busy === "dismiss" ? "Dismissing…" : "Dismiss"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mono-meta" style={{ marginTop: 8, color: "var(--color-mark-deep)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
