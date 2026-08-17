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
  } = useTabs();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const composer = useRef<ComposerHandle>(null);
  const reading = useRef<HTMLDivElement>(null);
  const openedShare = useRef(false);

  useEffect(() => {
    if (!hydrated || !openShareId || openedShare.current) return;
    openedShare.current = true;
    void openShared(openShareId).then((result) => {
      if ("error" in result) setShareNotice(result.error);
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
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--color-paper)" }}>
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
      />

      <div style={{ flex: 1, display: "flex", minWidth: 0, minHeight: 0 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          <header
            className="no-print"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "15px 34px",
              borderBottom: "1px solid rgba(0,0,0,.1)",
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
                font: "500 14px/1 var(--font-sans)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {active.title}
            </span>

            <span style={{ flex: "none", font: "400 11px/1 var(--font-mono)", color: "var(--meta-dim)" }}>
              {turnCount} question{turnCount === 1 ? "" : "s"} ·{" "}
              {active.kind === "group" && active.shareId ? "shared" : "local only"}
            </span>

            <span style={{ marginLeft: "auto", display: "flex", gap: 8, flex: "none" }}>
              {showRail && (
                <button
                  type="button"
                  onClick={() => {
                    setFocusRequest(null);
                    setSourcesOpen(true);
                  }}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 6,
                    border: 0,
                    background: "var(--color-ink)",
                    color: "var(--color-paper)",
                    font: "500 11.5px/1 var(--font-sans)",
                    cursor: "pointer",
                  }}
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
            style={{
              flex: 1,
              overflowY: "auto",
              padding: turnCount === 0 ? "0 34px" : "30px 34px 0",
              display: "flex",
              justifyContent: "center",
              alignItems: turnCount === 0 ? "center" : undefined,
            }}
          >
            {shareNotice && (
              <div style={{ width: "100%", maxWidth: 680, marginTop: 24 }}>
                <div
                  style={{
                    padding: "11px 13px",
                    background: "var(--amber-tint)",
                    borderLeft: "2px solid var(--color-amber)",
                    font: "400 13px/1.55 var(--font-sans)",
                    color: "#5c4110",
                  }}
                >
                  {shareNotice}
                </div>
              </div>
            )}

            {turnCount === 0 ? (
              <div style={{ width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ font: "500 21px/1 var(--font-serif)", letterSpacing: "-.015em", marginBottom: 14 }}>
                  Sourcely
                  <sup
                    style={{ font: "500 10px/1 var(--font-mono)", color: "var(--color-amber)", verticalAlign: "super" }}
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
              <div style={{ width: "100%", maxWidth: 680, paddingBottom: 40 }}>
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
              className="no-print"
              style={{
                flex: "none",
                borderTop: "1px solid var(--hairline-soft)",
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
