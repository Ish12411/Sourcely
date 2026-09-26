"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Composer, { type ComposerHandle } from "./Composer";
import Sidebar from "./Sidebar";
import SourcesModal, { type FocusRequest } from "./SourcesModal";
import TabEditDialog from "./TabEditDialog";
import Thread from "./Thread";
import { buildThreadSources } from "@/lib/threadSources";
import { useTabs } from "@/lib/useTabs";

const EXAMPLES = [
  "What caused the 1973 oil crisis?",
  "How does CRISPR-Cas9 edit a gene?",
  "Why did the Treaty of Versailles fail?",
];

const ALWAYS_OFFERED = ["Can I have more sources?", "Explain this more simply"];

/** Matches MAX_SOURCES on the server; only used for the loading copy. */
const MAX_SOURCES = 8;

export default function Workspace({ openShareId }: { openShareId?: string }) {
  const {
    tabs,
    active,
    hydrated,
    setActiveId,
    sidebarCollapsed,
    toggleSidebar,
    addTab,
    closeTab,
    renameTab,
    setStyle,
    setScope,
    ask,
    retry,
    share,
    openShared,
    refreshShared,
    user,
    migratable,
    migrateLocalThreads,
    dismissMigration,
  } = useTabs();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  /**
   * A one-off message above the thread. `transient` marks a confirmation of
   * something that already happened — it clears itself, because a banner that
   * outlives its news becomes furniture. Errors stay until dismissed.
   */
  const [shareNotice, setShareNotice] = useState<{ text: string; transient: boolean } | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => {
    if (!shareNotice?.transient) return;
    const timer = setTimeout(() => setShareNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [shareNotice]);

  const composer = useRef<ComposerHandle>(null);
  const reading = useRef<HTMLDivElement>(null);
  const openedShare = useRef(false);

  useEffect(() => {
    if (!hydrated || !openShareId || openedShare.current) return;
    openedShare.current = true;
    void openShared(openShareId).then((result) => {
      if ("error" in result) setShareNotice({ text: result.error, transient: false });
    });
  }, [hydrated, openShareId, openShared]);

  useEffect(() => {
    if (!active?.shareId) return;
    const onFocus = () => void refreshShared(active.id);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [active?.id, active?.shareId, refreshShared]);

  const turnCount = active?.turns.length ?? 0;
  useEffect(() => {
    // Keep the newest question in view as the thread grows.
    if (turnCount > 0 && reading.current) {
      reading.current.scrollTop = reading.current.scrollHeight;
    }
  }, [turnCount]);

  // ⌘\ / Ctrl+\ collapses the sidebar; N starts a new thread.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.key === "\\" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        addTab("personal");
        composer.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar, addTab]);

  const { rail, numberMap } = useMemo(
    () => buildThreadSources(active?.turns ?? []),
    [active?.turns]
  );

  // A marker opens the overlay on the card it points at.
  const onMarkerClick = useCallback((threadNumber: number) => {
    setSourcesOpen(true);
    setFocusRequest({ number: threadNumber, nonce: Date.now() });
  }, []);

  if (!hydrated || !active) {
    return <div style={{ height: "100vh", background: "var(--color-paper)" }} />;
  }

  const busy = active.turns.some((t) => t.status === "loading");
  // A "more sources" turn returns no follow-ups by design, so reach back to
  // the most recent turn that actually produced some rather than letting the
  // suggestions collapse to a single chip.
  const lastDone = [...active.turns]
    .reverse()
    .find((t) => t.status === "done" && (t.result?.followUps?.length ?? 0) > 0);
  // Two of the model's own suggestions plus "more sources" — enough to keep the
  // thread moving without the footer crowding out the answer.
  const suggestions =
    turnCount === 0
      ? EXAMPLES
      : [...(lastDone?.result?.followUps ?? []).slice(0, 2), ALWAYS_OFFERED[0]];
  const editing = tabs.find((t) => t.id === editingId) ?? null;
  const showRail = turnCount > 0;

  return (
    <div className="app-shell" style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--color-paper)" }}>
      <Sidebar
        tabs={tabs}
        activeId={active.id}
        collapsed={sidebarCollapsed}
        onSelect={(id) => {
          setActiveId(id);
          setDrawerOpen(false);
        }}
        onAdd={() => {
          addTab("personal");
          setDrawerOpen(false);
          composer.current?.focus();
        }}
        onEdit={setEditingId}
        onToggleCollapsed={toggleSidebar}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
        user={user}
      />

      <div style={{ flex: 1, display: "flex", minWidth: 0, minHeight: 0 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          <header
            className="no-print app-header"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "16px 34px",
              borderBottom: "1px solid var(--rule)",
              flex: "none",
            }}
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden"
              aria-label="Open sidebar"
              style={{ background: "none", border: 0, cursor: "pointer", font: "400 14px/1 var(--font-mono)" }}
            >
              ☰
            </button>

            <span
              style={{
                // Must be allowed to shrink, or a long thread title pushes the
                // header actions off the right edge on a narrow screen.
                flex: 1,
                minWidth: 0,
                font: "500 0.875rem/1 var(--font-sans)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {active.title}
            </span>

            <span
              className="header-meta"
              style={{ flex: "none", font: "400 var(--step-label)/1 var(--font-mono)", color: "var(--meta-dim)" }}
            >
              {turnCount} question{turnCount === 1 ? "" : "s"} ·{" "}
              {active.kind === "group" && active.shareId ? "shared" : "local only"}
            </span>

            <span style={{ display: "flex", gap: 8, flex: "none" }}>
              {showRail && (
                <button
                  type="button"
                  onClick={() => {
                    setFocusRequest(null);
                    setSourcesOpen(true);
                  }}
                  className="btn-primary"
                  style={{ padding: "7px 13px" }}
                >
                  Sources {rail.length}
                </button>
              )}

              <button
                type="button"
                onClick={() => setEditingId(active.id)}
                className="outlined"
                style={{ padding: "7px 12px", font: "500 11.5px/1 var(--font-sans)" }}
              >
                Share
              </button>
            </span>
          </header>

          <div
            ref={reading}
            className="reading-area"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: turnCount === 0 ? "0 34px" : "30px 34px 0",
              display: "flex",
              // Column, not row. Without a direction this defaults to row, and
              // any banner above the thread becomes a flex sibling *beside* it
              // rather than above it — stealing horizontal space and shoving
              // the reading column off-centre and off the right edge.
              flexDirection: "column",
              alignItems: "center",
              justifyContent: turnCount === 0 ? "center" : "flex-start",
            }}
          >
            {migratable.length > 0 && (
              <MigrationPrompt
                count={migratable.length}
                onMove={async () => {
                  const { moved } = await migrateLocalThreads();
                  setShareNotice({
                    text:
                      moved > 0
                        ? `Moved ${moved} thread${moved === 1 ? "" : "s"} into your account.`
                        : "Nothing could be moved. Your threads are still here on this device.",
                    // A failure is worth reading at your own pace; a success is not.
                    transient: moved > 0,
                  });
                }}
                onDismiss={dismissMigration}
              />
            )}

            {shareNotice && (
              <div style={{ width: "100%", maxWidth: 744, marginBottom: 24 }}>
                <div
                  role="status"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "11px 13px",
                    background: "var(--mark-tint)",
                    borderLeft: "1px solid var(--color-mark)",
                    borderRadius: "var(--radius-tight)",
                    font: "400 0.8125rem/1.55 var(--font-sans)",
                    color: "var(--color-ink-prose)",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>{shareNotice.text}</span>
                  <button
                    type="button"
                    onClick={() => setShareNotice(null)}
                    aria-label="Dismiss"
                    style={{
                      flex: "none",
                      border: 0,
                      background: "none",
                      cursor: "pointer",
                      font: "400 0.75rem/1 var(--font-mono)",
                      color: "var(--meta)",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {turnCount === 0 ? (
              <div style={{ width: "100%", maxWidth: 744, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ font: "500 21px/1 var(--font-serif)", letterSpacing: "-.015em", marginBottom: 14 }}>
                  Sourcely
                  <sup
                    style={{ font: "500 10px/1 var(--font-mono)", color: "var(--color-mark)", verticalAlign: "super" }}
                  >
                    1
                  </sup>
                </div>
                <p
                  style={{
                    margin: "0 0 22px",
                    font: "400 23px/1.3 var(--font-serif)",
                    textWrap: "pretty",
                    textAlign: "center",
                  }}
                >
                  Ask an academic question.
                </p>
                <Composer ref={composer} busy={busy} variant="empty" suggestions={suggestions} onSubmit={(q) => void ask(active.id, q)} />
              </div>
            ) : (
              <div style={{ width: "100%", maxWidth: 744, paddingBottom: 40 }}>
                <Thread
                  turns={active.turns}
                  numberMaps={numberMap}
                  onMarkerClick={onMarkerClick}
                  onRetry={(turnId) => void retry(active.id, turnId)}
                  maxSources={MAX_SOURCES}
                />
              </div>
            )}
          </div>

          {turnCount > 0 && (
            <div
              className="no-print composer-dock"
              style={{
                flex: "none",
                borderTop: "1px solid var(--rule-soft)",
                padding: "16px 34px",
                background: "var(--color-paper-sunk)",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Composer
                ref={composer}
                busy={busy}
                variant="docked"
                suggestions={suggestions}
                onSubmit={(q) => void ask(active.id, q)}
              />
            </div>
          )}
        </div>

        {showRail && sourcesOpen && (
          <SourcesModal
            rail={rail}
            style={active.style}
            scope={active.scope}
            onStyleChange={(s) => setStyle(active.id, s)}
            onScopeChange={(s) => setScope(active.id, s)}
            focusRequest={focusRequest}
            onClose={() => setSourcesOpen(false)}
          />
        )}
      </div>

      {editing && (
        <TabEditDialog
          tab={editing}
          onClose={() => setEditingId(null)}
          onRename={(title) => renameTab(editing.id, title)}
          onShare={() => share(editing.id)}
          onDelete={() => {
            closeTab(editing.id);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Offered once, when someone signs in on a device that already has threads in
 * it. Nothing moves without an answer: on a shared school computer, silently
 * claiming whatever is in the browser would attach someone else's work to this
 * account.
 */
function MigrationPrompt({
  count,
  onMove,
  onDismiss,
}: {
  count: number;
  onMove: () => void | Promise<void>;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 744,
        marginBottom: 24,
        padding: "14px 16px",
        background: "var(--color-paper-sunk)",
        borderLeft: "1px solid var(--color-mark)",
      }}
    >
      <p
        style={{
          margin: 0,
          font: "400 0.9375rem/1.6 var(--font-serif)",
          color: "var(--color-ink-prose)",
          maxWidth: "58ch",
        }}
      >
        {count} thread{count === 1 ? "" : "s"} on this device {count === 1 ? "is" : "are"} not in your
        account yet. Move {count === 1 ? "it" : "them"} in, and {count === 1 ? "it" : "they"} will follow
        you to any device you sign in on.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center" }}>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onMove();
            } finally {
              setBusy(false);
            }
          }}
        >
          <span key={busy ? "b" : "i"} className="label-swap">
            {busy ? "Moving…" : `Move ${count === 1 ? "it" : "them"} in`}
          </span>
        </button>
        <button type="button" className="ink-action" onClick={onDismiss} disabled={busy}>
          Keep on this device only
        </button>
      </div>
    </div>
  );
}
