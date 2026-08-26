"use client";

import { useEffect, useState } from "react";
import type { Tab } from "@/lib/types";

type Props = {
  tab: Tab;
  onClose: () => void;
  onRename: (title: string) => void;
  onShare: () => Promise<{ shareId: string } | { error: string }>;
  onDelete: () => void;
};

export default function TabEditDialog({ tab, onClose, onRename, onShare, onDelete }: Props) {
  const [title, setTitle] = useState(tab.title);
  const [shareId, setShareId] = useState<string | null>(tab.shareId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const shareUrl = shareId && typeof window !== "undefined" ? `${window.location.origin}/t/${shareId}` : null;

  function save() {
    if (title.trim() !== tab.title) onRename(title);
    onClose();
  }

  async function toggleGroup() {
    if (shareId || busy) return;
    setBusy(true);
    setError(null);
    const result = await onShare();
    setBusy(false);
    if ("error" in result) setError(result.error);
    else setShareId(result.shareId);
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  const mailto = shareUrl
    ? `mailto:?subject=${encodeURIComponent(`Research: ${title}`)}&body=${encodeURIComponent(
        `I'm researching "${title}" in Sourcely. You can read it and add your own follow-up questions here:\n\n${shareUrl}\n`
      )}`
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rename thread"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="backdrop-in"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "var(--meta-dim)",
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
          boxShadow: "0 12px 40px rgba(22,19,13,.2)",
        }}
      >
        <h2 style={{ margin: "0 0 16px", font: "400 20px/1.3 var(--font-serif)" }}>Rename thread</h2>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          maxLength={200}
          autoFocus
          aria-label="Thread name"
          style={{
            width: "100%",
            padding: "12px 13px",
            background: "#fff",
            border: "1px solid var(--color-ink)",
            borderRadius: "var(--radius-control)",
            font: "400 14px/1.3 var(--font-sans)",
            color: "var(--color-ink)",
            outline: "none",
          }}
        />

        <div style={{ marginTop: 16, padding: 14, background: "var(--color-paper-sunk)", borderRadius: "var(--radius-panel)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "500 13px/1.3 var(--font-sans)" }}>Make this a group thread</div>
              <p style={{ margin: "5px 0 0", font: "400 11.5px/1.5 var(--font-mono)", color: "var(--meta)" }}>
                Syncs to a link. The link is the password — anyone who has it can read and ask more.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={Boolean(shareId)}
              aria-label="Make this a group thread"
              onClick={toggleGroup}
              disabled={busy || Boolean(shareId)}
              title={shareId ? "Already shared — the link can't be withdrawn from here" : undefined}
              style={{
                flex: "none",
                width: 38,
                height: 22,
                borderRadius: 999,
                border: 0,
                padding: 3,
                display: "flex",
                justifyContent: "flex-start",
                background: shareId ? "var(--color-ink)" : "rgba(22,19,13,.24)",
                cursor: shareId || busy ? "default" : "pointer",
                transition: "background var(--dur-fast) var(--ease-in-out)",
              }}
            >
              {/* The knob slides rather than teleports — justify-content moves
                  it, and the transform transition carries it across. */}
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 2px var(--shadow-soft)",
                  transition: "transform var(--dur) var(--ease-out)",
                  // 38px track - 3px padding either side - 16px knob = 16px travel.
                  transform: shareId ? "translateX(16px)" : "translateX(0)",
                }}
              />
            </button>
          </div>

          {busy && (
            <p style={{ margin: "10px 0 0", font: "400 11.5px/1.5 var(--font-mono)", color: "var(--meta)" }}>
              Creating link…
            </p>
          )}

          {shareUrl && (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <div
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: "9px 10px",
                  background: "#fff",
                  borderRadius: "var(--radius-control)",
                  font: "400 11.5px/1.4 var(--font-mono)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {shareUrl}
              </div>
              <button
                type="button"
                onClick={copyLink}
                className="outlined"
                style={{ padding: "8px 11px", font: "500 11.5px/1 var(--font-sans)" }}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={mailto ?? "#"}
                className="outlined"
                style={{
                  padding: "8px 11px",
                  font: "500 11.5px/1 var(--font-sans)",
                  color: "var(--color-ink)",
                  textDecoration: "none",
                }}
              >
                Email
              </a>
            </div>
          )}

          {error && (
            <p style={{ margin: "10px 0 0", font: "400 11.5px/1.5 var(--font-sans)", color: "#8a3d12" }}>{error}</p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
          {confirmDelete ? (
            <>
              <span style={{ font: "400 11.5px/1.4 var(--font-mono)", color: "var(--meta)" }}>Delete thread?</span>
              <button
                type="button"
                onClick={onDelete}
                style={{
                  font: "500 11.5px/1 var(--font-sans)",
                  color: "#8a3d12",
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                style={{
                  font: "400 11.5px/1 var(--font-sans)",
                  color: "var(--body-secondary)",
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                Keep
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{
                font: "400 11.5px/1 var(--font-sans)",
                color: "var(--body-secondary)",
                background: "none",
                border: 0,
                cursor: "pointer",
              }}
            >
              Delete thread
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: "auto",
              font: "500 12px/1 var(--font-sans)",
              color: "var(--body-secondary)",
              background: "none",
              border: 0,
              cursor: "pointer",
              padding: "9px 6px",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            style={{
              padding: "9px 16px",
              background: "var(--color-ink)",
              color: "var(--color-paper)",
              borderRadius: "var(--radius-control)",
              font: "500 12px/1 var(--font-sans)",
              border: 0,
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
