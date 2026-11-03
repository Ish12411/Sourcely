import type { SignedInUser } from "@/lib/supabase/server";

/**
 * Who may use the /admin moderation page. Set ADMIN_EMAILS in Vercel to a
 * comma-separated list of the accounts allowed in; until then it falls back to
 * the published contact address.
 */
export function isAdmin(user: SignedInUser | null): boolean {
  if (!user?.email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "ishrao1204@hotmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(user.email.toLowerCase());
}
