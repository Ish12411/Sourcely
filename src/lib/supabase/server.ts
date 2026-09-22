import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

/**
 * Server-side Supabase client bound to the request's cookies.
 *
 * Used only to read who is signed in. Thread data is still fetched with the
 * service-role client in `@/lib/supabase`, after this has established identity.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

export type SignedInUser = { id: string; email: string | null };

/**
 * The signed-in user, or null.
 *
 * Uses getUser(), which revalidates the token against Supabase, rather than
 * getSession(), which trusts whatever the cookie says. For anything that gates
 * access to data, the difference matters: a session cookie can be forged, a
 * verified user cannot.
 */
export async function getCurrentUser(): Promise<SignedInUser | null> {
  // A native app has no cookie jar. The mobile client signs in against
  // Supabase directly and presents its access token as a bearer, which is
  // verified here by the same getUser() round-trip the cookie path uses —
  // so both paths reject a forged or expired token identically.
  const bearer = (await headers()).get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.auth.getUser(bearer);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? null };
}
