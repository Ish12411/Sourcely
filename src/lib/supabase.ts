/**
 * Minimal Supabase access over PostgREST, using the service-role key.
 *
 * Server-side only. All thread data flows through this module and this app's
 * own /api routes, never from the browser, so Row Level Security stays fully
 * closed with no policies at all.
 *
 * Since accounts were added the browser does hold the anon key, but only to
 * sign people in and out — it reads and writes no table. That key confers no
 * data access on its own, which is exactly why RLS can stay shut: with no
 * policies, an anon-key request to any table returns nothing.
 *
 * The consequence to remember: the service-role key bypasses RLS entirely, so
 * the `owner_id` filters in this file are the only thing standing between one
 * person's threads and another's. There is no database-level backstop.
 */

import type { SharedConversation, Scope, StyleId, Turn } from "./types";

const TABLE = "conversations";

export class ShareNotConfiguredError extends Error {
  constructor() {
    super(
      "Sharing isn't set up yet. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local — see the README for the one table it needs."
    );
    this.name = "ShareNotConfiguredError";
  }
}

export class ShareError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
    this.name = "ShareError";
  }
}

export function isShareConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ShareNotConfiguredError();
  return { url: url.replace(/\/$/, ""), key };
}

async function rest(path: string, init: RequestInit & { prefer?: string } = {}) {
  const { url, key } = config();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (init.prefer) headers.Prefer = init.prefer;

  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers, cache: "no-store" });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 404 || /relation .* does not exist/i.test(detail)) {
      throw new ShareError(
        `The "${TABLE}" table doesn't exist in your Supabase project yet. Run the SQL in the README.`,
        500
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new ShareError("Supabase rejected the service-role key. Check SUPABASE_SERVICE_ROLE_KEY.", 500);
    }
    if (res.status === 409) {
      // Unique-key conflict: a row with that id already exists.
      throw new ShareError("conflict", 409);
    }
    throw new ShareError(`Supabase request failed (${res.status}). ${detail.slice(0, 200)}`, 502);
  }

  return res;
}

/** URL-safe, unguessable, and short enough to paste into a chat. */
export function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 22);
}

type Row = {
  share_id: string;
  owner_id: string | null;
  title: string;
  style: string;
  scope: string;
  turns: Turn[];
  updated_at: string;
};

/**
 * Every turn carries who asked it. Turns added to a group thread are stamped
 * with their author by the server (appendToConversation); older ones, and the
 * owner's own, have none stored, and those were asked by the owner.
 */
function withAuthors(turns: unknown, ownerId: string | null): Turn[] {
  if (!Array.isArray(turns)) return [];
  return (turns as Turn[]).map((t) => (t.authorId || !ownerId ? t : { ...t, authorId: ownerId }));
}

function toConversation(row: Row): SharedConversation {
  return {
    shareId: row.share_id,
    title: row.title,
    style: row.style as StyleId,
    scope: row.scope as Scope,
    turns: withAuthors(row.turns, row.owner_id),
    updatedAt: row.updated_at,
  };
}

export async function createConversation(input: {
  title: string;
  style: StyleId;
  scope: Scope;
  turns: Turn[];
  /** Who owns it. Null only for rows created before accounts existed. */
  ownerId?: string | null;
}): Promise<SharedConversation> {
  const shareId = newShareId();
  const res = await rest(TABLE, {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({
      share_id: shareId,
      title: input.title,
      style: input.style,
      scope: input.scope,
      turns: input.turns,
      owner_id: input.ownerId ?? null,
    }),
  });
  const rows = (await res.json()) as Row[];
  if (!rows.length) throw new ShareError("Supabase created no row.", 502);
  return toConversation(rows[0]);
}

export async function getConversation(shareId: string): Promise<SharedConversation | null> {
  const res = await rest(`${TABLE}?share_id=eq.${encodeURIComponent(shareId)}&select=*`);
  const rows = (await res.json()) as Row[];
  return rows.length ? toConversation(rows[0]) : null;
}

/** The stored row behind a share link, including who owns it. */
async function getConversationRow(shareId: string): Promise<Row | null> {
  const res = await rest(`${TABLE}?share_id=eq.${encodeURIComponent(shareId)}&select=*`);
  const rows = (await res.json()) as Row[];
  return rows.length ? rows[0] : null;
}

export class ContributionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ContributionError";
  }
}

/** Most turns a group thread can hold, so one link can't grow without bound. */
const MAX_SHARED_TURNS = 100;

/**
 * Add a signed-in person's new questions to a group thread.
 *
 * Add-only. This replaced a write that stored whatever turns the client sent,
 * so anyone with the link could rewrite or delete other people's questions.
 * Now the stored turns are kept exactly as they are, only turns with new ids
 * and a finished answer are appended, and each is stamped with its author —
 * which is what Report and Block act on. Renaming and changing the style or
 * scope are the owner's alone. Anyone the owner has blocked is refused.
 */
export async function appendToConversation(
  shareId: string,
  callerId: string,
  patch: Partial<{ title: string; style: StyleId; scope: Scope; turns: Turn[] }>,
  check: (turn: Turn) => string | null
): Promise<SharedConversation | null> {
  const row = await getConversationRow(shareId);
  if (!row) return null;
  const isOwner = row.owner_id === callerId;

  if (row.owner_id && !isOwner) {
    const blocked = (await getUserMetadata(row.owner_id))?.blocked_user_ids;
    if (Array.isArray(blocked) && blocked.includes(callerId)) {
      throw new ContributionError("The owner of this thread has blocked you from adding to it.", 403);
    }
  }

  const stored = Array.isArray(row.turns) ? row.turns : [];
  const known = new Set(stored.map((t) => t.id));
  const additions = (patch.turns ?? [])
    .filter((t) => t && typeof t.id === "string" && !known.has(t.id) && (t.status === "done" || t.status === "error"))
    .map((t) => ({ ...t, authorId: callerId, progress: undefined }));

  for (const t of additions) {
    const problem = check(t);
    if (problem) throw new ContributionError(problem, 422);
  }
  if (stored.length + additions.length > MAX_SHARED_TURNS) {
    throw new ContributionError("This thread is full. Start a new one to keep going.", 409);
  }

  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (additions.length) body.turns = [...stored, ...additions];
  if (isOwner) {
    if (patch.title !== undefined) body.title = patch.title;
    if (patch.style !== undefined) body.style = patch.style;
    if (patch.scope !== undefined) body.scope = patch.scope;
  }

  const res = await rest(`${TABLE}?share_id=eq.${encodeURIComponent(shareId)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: JSON.stringify(body),
  });
  const rows = (await res.json()) as Row[];
  return rows.length ? toConversation(rows[0]) : null;
}

/** A user's metadata, read with the service key. Null if they don't exist. */
export async function getUserMetadata(userId: string): Promise<Record<string, unknown> | null> {
  const { url, key } = config();
  const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { user_metadata?: Record<string, unknown> };
  return user.user_metadata ?? {};
}

/** Find one turn in a group thread, to check a report against. */
export async function findSharedTurn(shareId: string, turnId: string): Promise<Turn | null> {
  const row = await getConversationRow(shareId);
  if (!row) return null;
  return withAuthors(row.turns, row.owner_id).find((t) => t.id === turnId) ?? null;
}

export type ReportRecord = {
  reporter_id: string;
  share_id: string;
  turn_id: string;
  author_id: string | null;
  reason: string;
  note: string;
  question: string;
};

/**
 * Store a content report in the `reports` table. Returns false if that fails
 * (for instance the table hasn't been created yet; the SQL is in DEPLOY.md),
 * and the caller logs the report so it still reaches the server logs.
 */
export async function saveReport(report: ReportRecord): Promise<boolean> {
  try {
    await rest("reports", { method: "POST", body: JSON.stringify(report) });
    return true;
  } catch (err) {
    console.error("[report] couldn't store report:", err instanceof Error ? err.message : err);
    return false;
  }
}

/* ------------------------------------------------------------- threads

   A signed-in person's own threads. Same table as shared conversations: a
   thread with a share_id is shared, one without is private to its owner. One
   table means "make this thread shareable" is a column write, not a migration
   between two stores.

   Every function here takes an ownerId and filters on it. The service-role key
   bypasses Row Level Security, so this filter IS the access control — there is
   no second layer behind it to catch a mistake. */

export type OwnedThread = {
  id: string;
  title: string;
  style: StyleId;
  scope: Scope;
  turns: Turn[];
  shareId: string | null;
  updatedAt: string;
};

type OwnedRow = {
  id: string;
  owner_id: string | null;
  title: string;
  style: string;
  scope: string;
  turns: Turn[];
  share_id: string | null;
  updated_at: string;
};

function toThread(row: OwnedRow): OwnedThread {
  return {
    id: row.id,
    title: row.title,
    style: row.style as StyleId,
    scope: row.scope as Scope,
    turns: withAuthors(row.turns, row.owner_id),
    shareId: row.share_id,
    updatedAt: row.updated_at,
  };
}

export async function listThreads(ownerId: string): Promise<OwnedThread[]> {
  const res = await rest(
    `${TABLE}?owner_id=eq.${encodeURIComponent(ownerId)}&select=*&order=updated_at.desc`
  );
  const rows = (await res.json()) as OwnedRow[];
  return rows.map(toThread);
}

/**
 * Create or update one thread. The client supplies the id, so a thread keeps
 * the same identity from the moment it is created locally through every later
 * sync — no reconciliation of local ids against server ids.
 *
 * Update-if-owned, else insert. This used to be a single upsert that merged on
 * id, which meant writing someone else's thread id overwrote their thread and
 * moved it into your account — reachable from a phone that had another
 * account's threads cached. Now an existing row is only touched when owner_id
 * matches, and an id that belongs to anyone else is refused.
 */
export async function upsertThread(input: {
  id: string;
  ownerId: string;
  title: string;
  style: StyleId;
  scope: Scope;
  turns: Turn[];
}): Promise<OwnedThread> {
  const fields = {
    title: input.title,
    style: input.style,
    scope: input.scope,
    turns: input.turns,
    updated_at: new Date().toISOString(),
  };

  const updated = await rest(
    `${TABLE}?id=eq.${encodeURIComponent(input.id)}&owner_id=eq.${encodeURIComponent(input.ownerId)}`,
    { method: "PATCH", prefer: "return=representation", body: JSON.stringify(fields) }
  );
  const updatedRows = (await updated.json()) as OwnedRow[];
  if (updatedRows.length) return toThread(updatedRows[0]);

  try {
    const inserted = await rest(TABLE, {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({ id: input.id, owner_id: input.ownerId, ...fields }),
    });
    const rows = (await inserted.json()) as OwnedRow[];
    if (!rows.length) throw new ShareError("Supabase wrote no row.", 502);
    return toThread(rows[0]);
  } catch (err) {
    if (err instanceof ShareError && err.status === 409) {
      throw new ShareError("That thread belongs to another account.", 403);
    }
    throw err;
  }
}

/** Deletes only if the caller owns it; a foreign id silently matches nothing. */
export async function deleteThread(id: string, ownerId: string): Promise<void> {
  await rest(
    `${TABLE}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    { method: "DELETE" }
  );
}

/** Attach a share id to a thread the caller owns, making it reachable by link. */
export async function shareOwnedThread(id: string, ownerId: string): Promise<string | null> {
  const shareId = newShareId();
  const res = await rest(
    `${TABLE}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: JSON.stringify({ share_id: shareId, updated_at: new Date().toISOString() }),
    }
  );
  const rows = (await res.json()) as OwnedRow[];
  return rows.length ? rows[0].share_id : null;
}

/* ---------------------------------------------------------- account

   Apple requires any app with account creation to let people delete their
   account from inside the app, and to remove "any data associated with the
   account", explicitly including content shared with others. */

/**
 * Remove every thread a person owns — private and shared alike. Returns how
 * many rows went, so the caller can report it.
 *
 * The owner_id foreign key is declared ON DELETE CASCADE, so deleting the auth
 * user would take these rows with it anyway. This is done explicitly and first
 * regardless: it does not depend on the migration having been run exactly as
 * written, and if the later auth deletion fails, the person's data is already
 * gone — the order that errs on the side of their privacy.
 */
export async function deleteAllThreadsFor(ownerId: string): Promise<number> {
  const res = await rest(`${TABLE}?owner_id=eq.${encodeURIComponent(ownerId)}`, {
    method: "DELETE",
    prefer: "return=representation",
  });
  const rows = (await res.json()) as unknown[];
  return rows.length;
}

/** Delete the Supabase auth user. Service-role only; never reachable from a browser. */
export async function deleteAuthUser(userId: string): Promise<void> {
  const { url, key } = config();
  const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  // 404 means already gone, which is the state we wanted.
  if (!res.ok && res.status !== 404) {
    const detail = await res.text().catch(() => "");
    throw new ShareError(`Couldn't delete the account (${res.status}). ${detail.slice(0, 160)}`, 502);
  }
}

/* ------------------------------------------------------------ moderation

   The developer's side of Report (App Store Guideline 1.2 asks for reports to
   be acted on within 24 hours). Used only by the /admin page, which checks
   the caller is on the ADMIN_EMAILS list first. */

export type StoredReport = ReportRecord & { id: string; created_at: string; resolved_at: string | null };

/** Reports, newest first, unresolved before resolved. */
export async function listReports(): Promise<StoredReport[]> {
  const res = await rest("reports?select=*&order=resolved_at.desc.nullsfirst,created_at.desc&limit=200");
  return (await res.json()) as StoredReport[];
}

export async function resolveReport(id: string): Promise<void> {
  await rest(`reports?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ resolved_at: new Date().toISOString() }),
  });
}

/** Take one question out of a group thread, for everyone. */
export async function removeSharedTurn(shareId: string, turnId: string): Promise<boolean> {
  const row = await getConversationRow(shareId);
  if (!row) return false;
  const turns = (Array.isArray(row.turns) ? row.turns : []).filter((t) => t.id !== turnId);
  await rest(`${TABLE}?share_id=eq.${encodeURIComponent(shareId)}`, {
    method: "PATCH",
    body: JSON.stringify({ turns, updated_at: new Date().toISOString() }),
  });
  return true;
}

/** Stop someone signing in to Sourcely at all (Supabase's account ban). */
export async function banUser(userId: string): Promise<void> {
  const { url, key } = config();
  const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    // Supabase takes a duration, not a flag; a hundred years is "for good".
    body: JSON.stringify({ ban_duration: "876000h" }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ShareError(`Couldn't ban that account (${res.status}). ${detail.slice(0, 160)}`, 502);
  }
}
