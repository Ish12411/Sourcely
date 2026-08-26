"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Auth only.
 *
 * This ships the anon key to the browser, which is what it is designed for —
 * it identifies the project and carries no privileges of its own. Row Level
 * Security stays fully closed on every table, and no thread data is ever read
 * or written through this client. Reads and writes all go through this app's
 * own /api routes, which use the service-role key server-side and check the
 * signed-in user first. The anon key here can do exactly one thing: sign a
 * person in or out.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Sign-in is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
    );
  }

  return createBrowserClient(url, key);
}

/** True when the public auth env vars exist, so the UI can explain itself. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
