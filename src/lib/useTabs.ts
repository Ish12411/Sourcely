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

/** One row as /api/threads returns it. */
type ServerThread = {
  id: string;
  title: string;
  style: StyleId;
  scope: Scope;
  turns: Turn[];
  shareId: string | null;
  updatedAt: string;
};

let seq = 0;
function newId(prefix: string): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}-${seq}`;
}

/**
 * Thread ids are real UUIDs because they are also the primary key of the
 * `conversations` row. Generating them on the client means a thread keeps one
 * identity from its first keystroke through every later sync, with nothing to
 * reconcile between a local id and a server id.
 */
function newThreadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Older Safari over plain http has no randomUUID; this is only ever a
  // local-storage key in that case, since sync needs https anyway.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Threads created before accounts existed have ids the database will reject. */
export function isSyncableId(id: string): boolean {
  return UUID_RE.test(id);
}

function newTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: newThreadId(),
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

  /* ------------------------------------------------------------ account */

  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [accountLoaded, setAccountLoaded] = useState(false);
  /** Local threads that predate this account and could be adopted into it. */
  const [migratable, setMigratable] = useState<Tab[]>([]);

  // localStorage remains the working store: it is instant and survives a
  // dropped connection. The server is the durable copy, pulled once on load
  // and written through on change.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    (async () => {
      try {
        const meRes = await fetch("/api/me");
        const me = await meRes.json().catch(() => ({}));
        if (cancelled) return;
        setUser(me?.user ?? null);
        if (!me?.user) return;

        const res = await fetch("/api/threads");
        if (!res.ok) return;
        const { threads } = (await res.json()) as { threads: ServerThread[] };
        if (cancelled || !Array.isArray(threads)) return;

        const serverIds = new Set(threads.map((t) => t.id));
        const local = tabsRef.current;

        // An empty untouched tab is not work worth migrating or keeping.
        const localWithWork = local.filter((t) => t.turns.length > 0);
        setMigratable(localWithWork.filter((t) => !serverIds.has(t.id)));

        if (threads.length > 0) {
          const adopted: Tab[] = threads.map((t) => ({
            id: t.id,
            title: t.title,
            kind: t.shareId ? ("group" as const) : ("personal" as const),
            style: t.style,
            scope: t.scope,
            turns: Array.isArray(t.turns) ? t.turns : [],
            createdAt: t.updatedAt,
            shareId: t.shareId,
            seenTurns: Array.isArray(t.turns) ? t.turns.length : 0,
          }));
          // Server threads lead; any local thread not on the server stays
          // visible so nothing appears to vanish before the migration prompt
          // has been answered.
          const keptLocal = local.filter((t) => !serverIds.has(t.id) && t.turns.length > 0);
          const merged = [...adopted, ...keptLocal];
          setTabs(merged);
          setActiveIdRaw((current) =>
            merged.some((t) => t.id === current) ? current : merged[0].id
          );
        }
      } catch {
        // Offline or misconfigured: keep working from localStorage.
      } finally {
        if (!cancelled) setAccountLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  /**
   * Write-through, debounced. Only threads with actual content are pushed —
   * an empty tab left open on every device would otherwise sync as clutter.
   */
  const pushTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const queueSync = useCallback(
    (tabId: string) => {
      if (!user) return;
      const existing = pushTimers.current.get(tabId);
      if (existing) clearTimeout(existing);

      pushTimers.current.set(
        tabId,
        setTimeout(async () => {
          pushTimers.current.delete(tabId);
          const tab = tabsRef.current.find((t) => t.id === tabId);
          if (!tab || tab.turns.length === 0 || !isSyncableId(tab.id)) return;
          try {
            await fetch("/api/threads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: tab.id,
                title: tab.title,
                style: tab.style,
                scope: tab.scope,
                turns: tab.turns,
              }),
            });
          } catch {
            // Keep the local copy; the next change retries.
          }
        }, 900)
      );
    },
    [user]
  );

  useEffect(() => {
    const timers = pushTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  /** Adopt the local threads listed in `migratable` into the account. */
  const migrateLocalThreads = useCallback(async (): Promise<{ moved: number }> => {
    if (!user) return { moved: 0 };
    let moved = 0;

    for (const tab of migratable) {
      // A pre-account thread carries an id the database will not accept, so it
      // is re-keyed on the way up rather than dropped.
      const id = isSyncableId(tab.id) ? tab.id : newThreadId();
      try {
        const res = await fetch("/api/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            title: tab.title,
            style: tab.style,
            scope: tab.scope,
            turns: tab.turns,
          }),
        });
        if (!res.ok) continue;
        moved += 1;
        if (id !== tab.id) {
          setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, id } : t)));
          setActiveIdRaw((current) => (current === tab.id ? id : current));
        }
      } catch {
        // Leave it local; the prompt can be offered again next load.
      }
    }

    setMigratable([]);
    return { moved };
  }, [migratable, user]);

  const dismissMigration = useCallback(() => setMigratable([]), []);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  /** Opening a tab clears its inbound badge. */
  const setActiveId = useCallback((id: string) => {
    setActiveIdRaw(id);
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, seenTurns: t.turns.length } : t)));
  }, []);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);

  // Every mutation in this hook funnels through patch/patchTurn, so queueing
  // the sync here covers renames, style and scope changes, and new answers
  // without each caller having to remember.
  const patch = useCallback(
    (id: string, changes: Partial<Tab>) => {
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));
      queueSync(id);
    },
    [queueSync]
  );

  const patchTurn = useCallback((tabId: string, turnId: string, changes: Partial<Turn>) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? { ...t, turns: t.turns.map((turn) => (turn.id === turnId ? { ...turn, ...changes } : turn)) }
          : t
      )
    );
    queueSync(tabId);
  }, [queueSync]);

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

  /**
   * Give this thread a share link.
   *
   * Threads are rows already, so sharing sets `share_id` on the row that
   * exists rather than creating a second copy — the pre-accounts version
   * POSTed a whole new conversation, which would now duplicate the thread.
   */
  const share = useCallback(
    async (tabId: string): Promise<{ shareId: string } | { error: string }> => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab) return { error: "That thread no longer exists." };
      if (tab.shareId) return { shareId: tab.shareId };
      if (!user) return { error: "Sign in to share a thread." };
      if (tab.turns.length === 0) return { error: "Ask a question first — there is nothing to share yet." };

      patch(tabId, { syncing: true, shareError: null });
      try {
        // Make sure the row exists and is current before attaching a link to
        // it; a thread whose debounce has not fired yet has no row at all.
        await fetch("/api/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: tab.id,
            title: tab.title,
            style: tab.style,
            scope: tab.scope,
            turns: tab.turns,
          }),
        });

        const res = await fetch(`/api/threads/${tab.id}`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const error = data?.error ?? "Couldn't create the share link.";
          patch(tabId, { syncing: false, shareError: error });
          return { error };
        }

        patch(tabId, {
          kind: "group",
          shareId: data.shareId,
          syncing: false,
          shareError: null,
        });
        return { shareId: data.shareId as string };
      } catch {
        const error = "Couldn't reach the server to create a share link.";
        patch(tabId, { syncing: false, shareError: error });
        return { error };
      }
    },
    [patch, user]
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

      // Cancel any queued write first, or the debounce fires after the delete
      // and resurrects the row.
      const pending = pushTimers.current.get(id);
      if (pending) {
        clearTimeout(pending);
        pushTimers.current.delete(id);
      }
      if (user && isSyncableId(id)) {
        void fetch(`/api/threads/${id}`, { method: "DELETE" }).catch(() => {});
      }

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
    [activeId, setActiveId, user]
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
    user,
    accountLoaded,
    migratable,
    migrateLocalThreads,
    dismissMigration,
  };
}
