/**
 * Minimal Supabase access over PostgREST.
 *
 * Deliberately server-side only, using the service-role key. Row Level
 * Security can stay fully closed to the public: the browser never talks to
 * Supabase, it talks to our own /api/share routes, which only ever look a row
 * up by its unguessable share id. No anon key ships to the client.
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
  title: string;
  style: string;
  scope: string;
  turns: Turn[];
  updated_at: string;
};

function toConversation(row: Row): SharedConversation {
  return {
    shareId: row.share_id,
    title: row.title,
    style: row.style as StyleId,
    scope: row.scope as Scope,
    turns: Array.isArray(row.turns) ? row.turns : [],
    updatedAt: row.updated_at,
  };
}

export async function createConversation(input: {
  title: string;
  style: StyleId;
  scope: Scope;
  turns: Turn[];
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

export async function updateConversation(
  shareId: string,
  patch: Partial<{ title: string; style: StyleId; scope: Scope; turns: Turn[] }>
): Promise<SharedConversation | null> {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.style !== undefined) body.style = patch.style;
  if (patch.scope !== undefined) body.scope = patch.scope;
  if (patch.turns !== undefined) body.turns = patch.turns;

  const res = await rest(`${TABLE}?share_id=eq.${encodeURIComponent(shareId)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: JSON.stringify(body),
  });
  const rows = (await res.json()) as Row[];
  return rows.length ? toConversation(rows[0]) : null;
}
