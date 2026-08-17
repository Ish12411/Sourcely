"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_STYLE } from "./citations";
import type {
  HistoryTurn,
  ResearchResult,
  Scope,
  SharedConversation,
  StyleId,
  Tab,
  TabKind,
  Turn,
} from "./types";

const STORAGE_KEY = "sourcely.tabs.v3";

let seq = 0;
function newId(prefix: string): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}-${seq}`;
}

function newTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: newId("t"),
    title: "New research",
    kind: "personal",
    style: DEFAULT_STYLE,
    scope: "balanced",
    turns: [],
    createdAt: new Date().toISOString(),
    shareId: null,
    ...overrides,
  };
}

function titleFrom(question: string): string {
  return question.length > 48 ? `${question.slice(0, 48)}…` : question;
}

type Persisted = { tabs: Tab[]; activeId: string; sidebarCollapsed?: boolean };

function load(): Persisted | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return null;
    const tabs = parsed.tabs.map((t) => ({
      ...t,
      kind: t.kind ?? ("personal" as const),
      scope: t.scope ?? ("balanced" as const),
      shareId: t.shareId ?? null,
      syncing: false,
      shareError: null,
      // A turn persisted mid-request would otherwise spin forever.
      turns: (t.turns ?? []).map((turn) =>
        turn.status === "loading"
          ? { ...turn, status: "error" as const, error: "That search was interrupted. Ask it again." }
          : turn
      ),
    }));
    return {
      tabs,
      activeId: tabs.some((t) => t.id === parsed.activeId) ? parsed.activeId : tabs[0].id,
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
    };
  } catch {
    return null;
  }
}

export function useTabs() {
  const [firstTab] = useState(() => newTab());
  const [tabs, setTabs] = useState<Tab[]>([firstTab]);
  const [activeId, setActiveIdRaw] = useState(firstTab.id);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const controllers = useRef<Map<string, AbortController>>(new Map());
  // Async work needs the current tabs without re-creating every callback.
  const tabsRef = useRef<Tab[]>(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    const saved = load();
    if (saved) {
      setTabs(saved.tabs);
      setActiveIdRaw(saved.activeId);
      setSidebarCollapsed(Boolean(saved.sidebarCollapsed));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeId, sidebarCollapsed }));
    } catch {
      // Quota exceeded — the app still works, results just won't survive a reload.
    }
  }, [tabs, activeId, sidebarCollapsed, hydrated]);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  /** Opening a tab clears its inbound badge. */
  const setActiveId = useCallback((id: string) => {
    setActiveIdRaw(id);
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, seenTurns: t.turns.length } : t)));
  }, []);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);

  const patch = useCallback((id: string, changes: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  }, []);

  const patchTurn = useCallback((tabId: string, turnId: string, changes: Partial<Turn>) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? { ...t, turns: t.turns.map((turn) => (turn.id === turnId ? { ...turn, ...changes } : turn)) }
          : t
      )
    );
  }, []);

  /* ---------------------------------------------------------------- sharing */

  /** Push the local state of a group tab to the server. Best effort. */
  const pushShared = useCallback(async (tabId: string) => {
    const tab = tabsRef.current.find((t) => t.id === tabId);
    if (!tab?.shareId) return;
    try {
      await fetch(`/api/share/${tab.shareId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: tab.title,
          style: tab.style,
          scope: tab.scope,
          turns: tab.turns,
        }),
      });
    } catch {
      // Offline or the row is gone; the local copy is still intact.
    }
  }, []);

  /** Create the server-side row for a tab and return its share id. */
  const share = useCallback(
    async (tabId: string): Promise<{ shareId: string } | { error: string }> => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab) return { error: "That tab no longer exists." };
      if (tab.shareId) return { shareId: tab.shareId };

      patch(tabId, { syncing: true, shareError: null });
      try {
        const res = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: tab.title,
            style: tab.style,
            scope: tab.scope,
            turns: tab.turns,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const error = data?.error ?? "Couldn't create the share link.";
          patch(tabId, { syncing: false, shareError: error });
          return { error };
        }
        const conversation = data as SharedConversation;
        patch(tabId, {
          kind: "group",
          shareId: conversation.shareId,
          syncing: false,
          shareError: null,
        });
        return { shareId: conversation.shareId };
      } catch {
        const error = "Couldn't reach the server to create a share link.";
        patch(tabId, { syncing: false, shareError: error });
        return { error };
      }
    },
    [patch]
  );

  /** Pull a shared conversation into the sidebar, or focus it if already there. */
  const openShared = useCallback(
    async (shareId: string): Promise<{ ok: true } | { error: string }> => {
      const existing = tabsRef.current.find((t) => t.shareId === shareId);
      if (existing) {
        setActiveId(existing.id);
      }
      try {
        const res = await fetch(`/api/share/${shareId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { error: data?.error ?? "Couldn't open that shared link." };

        const conversation = data as SharedConversation;
        if (existing) {
          // Server is the source of truth for a shared tab on open.
          patch(existing.id, {
            title: conversation.title,
            style: conversation.style,
            scope: conversation.scope,
            turns: conversation.turns,
          });
          return { ok: true };
        }

        const created = newTab({
          title: conversation.title,
          kind: "group",
          style: conversation.style,
          scope: conversation.scope,
          turns: conversation.turns,
          shareId: conversation.shareId,
        });
        setTabs((prev) => [...prev, created]);
        setActiveId(created.id);
        return { ok: true };
      } catch {
        return { error: "Couldn't reach the server to open that link." };
      }
    },
    [patch]
  );

  /** Re-fetch a group tab so other people's follow-ups show up. */
  const refreshShared = useCallback(
    async (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab?.shareId) return;
      // Never clobber a turn that's mid-flight locally.
      if (tab.turns.some((t) => t.status === "loading")) return;
      try {
        const res = await fetch(`/api/share/${tab.shareId}`);
        if (!res.ok) return;
        const conversation = (await res.json()) as SharedConversation;
        if (conversation.turns.length > tab.turns.length) {
          patch(tabId, { turns: conversation.turns, title: conversation.title });
        }
      } catch {
        // Offline; keep what we have.
      }
    },
    [patch]
  );

  /* ------------------------------------------------------------------ tabs */

  const addTab = useCallback(
    (kind: TabKind = "personal") => {
      const source = tabsRef.current.find((t) => t.id === activeId);
      const created = newTab({
        kind,
        style: source?.style ?? DEFAULT_STYLE,
        scope: source?.scope ?? "balanced",
      });
      setTabs((prev) => [...prev, created]);
      setActiveId(created.id);
      return created.id;
    },
    [activeId]
  );

  const closeTab = useCallback(
    (id: string) => {
      const current = tabsRef.current;
      current
        .find((t) => t.id === id)
        ?.turns.forEach((turn) => {
          controllers.current.get(turn.id)?.abort();
          controllers.current.delete(turn.id);
        });

      if (current.length === 1) {
        const created = newTab({ style: current[0].style, scope: current[0].scope });
        setTabs([created]);
        setActiveId(created.id);
        return;
      }

      const index = current.findIndex((t) => t.id === id);
      const next = current.filter((t) => t.id !== id);
      setTabs(next);
      if (activeId === id) setActiveId(next[Math.max(0, index - 1)].id);
    },
    [activeId, setActiveId]
  );

  const renameTab = useCallback(
    (id: string, title: string) => {
      const clean = title.trim().slice(0, 200) || "Untitled research";
      patch(id, { title: clean });
      void pushShared(id);
    },
    [patch, pushShared]
  );

  const setStyle = useCallback(
    (id: string, style: StyleId) => {
      patch(id, { style });
      void pushShared(id);
    },
    [patch, pushShared]
  );

  const setScope = useCallback(
    (id: string, scope: Scope) => {
      patch(id, { scope });
      void pushShared(id);
    },
    [patch, pushShared]
  );

  /* ------------------------------------------------------------- asking */

  const ask = useCallback(
    async (tabId: string, question: string, opts: { replaceTurnId?: string } = {}) => {
      const trimmed = question.trim();
      if (!trimmed) return;

      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab) return;

      // A retry drops the failed turn. Compute the base list here rather than
      // patching first — tabsRef only catches up after a render, so a
      // patch-then-ask sequence would resurrect the turn it just removed.
      const baseTurns = opts.replaceTurnId
        ? tab.turns.filter((t) => t.id !== opts.replaceTurnId)
        : tab.turns;

      const turn: Turn = {
        id: newId("q"),
        question: trimmed,
        status: "loading",
        result: null,
        error: null,
        createdAt: new Date().toISOString(),
      };

      const controller = new AbortController();
      controllers.current.set(turn.id, controller);

      // Everything already answered becomes the model's memory of this thread.
      const history: HistoryTurn[] = baseTurns
        .filter((t) => t.status === "done" && t.result)
        .map((t) => ({
          question: t.question,
          searchQuery: t.result!.searchQuery || t.question,
          overview: t.result!.overview,
          sources: t.result!.sources.map((s) => ({
            number: s.number,
            title: s.title,
            url: s.url,
            siteName: s.siteName,
          })),
        }));

      patch(tabId, {
        turns: [...baseTurns, turn],
        title: baseTurns.length === 0 ? titleFrom(trimmed) : tab.title,
      });

      try {
        const res = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, scope: tab.scope, history }),
          signal: controller.signal,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          patchTurn(tabId, turn.id, {
            status: "error",
            error: data?.error ?? `Request failed (${res.status}).`,
          });
          return;
        }

        patchTurn(tabId, turn.id, { status: "done", result: data as ResearchResult, error: null });
        void pushShared(tabId);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        patchTurn(tabId, turn.id, {
          status: "error",
          error: "Couldn't reach the server. Check that the dev server is still running.",
        });
      } finally {
        controllers.current.delete(turn.id);
      }
    },
    [patch, patchTurn, pushShared]
  );

  /** Re-run a failed turn in place rather than appending a duplicate. */
  const retry = useCallback(
    async (tabId: string, turnId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      const turn = tab?.turns.find((t) => t.id === turnId);
      if (!tab || !turn) return;
      await ask(tabId, turn.question, { replaceTurnId: turnId });
    },
    [ask]
  );

  return {
    tabs,
    active,
    activeId,
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
  };
}
