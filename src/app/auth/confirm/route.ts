import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** The only link types this route will act on. */
const ALLOWED: EmailOtpType[] = ["recovery", "email", "signup", "email_change", "invite", "magiclink"];

/**
 * Where password-reset (and confirmation) emails land.
 *
 * Verifies the email's token_hash server-side and writes the session cookie.
 * This is Supabase's recommended pattern for server-rendered apps, and it is
 * what makes reset work from the Natively app: the request is made inside the
 * app, but the email opens in Mail or Safari. The default PKCE link needs a
 * code verifier stored in the browser that asked for it, so opened anywhere
 * else it fails. A token_hash needs nothing from the original browser.
 *
 * Requires the Supabase "Reset Password" email template to link here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/";

  const fail = (message: string) => {
    const back = new URL("/login", origin);
    back.searchParams.set("error", message);
    return NextResponse.redirect(back);
  };

  if (!tokenHash || !type || !ALLOWED.includes(type)) {
    return fail("That link is incomplete. Request a new one.");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail("Sign-in is not configured on the server.");

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    // Links are single-use and expire; this is the common case, so say so.
    return fail("That link has expired or was already used. Request a new one.");
  }

  // Same-origin paths only. Passing an unchecked `next` to redirect() would be
  // an open redirect — a link that looks like Sourcely but lands elsewhere.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(new URL(safeNext, origin));
}
