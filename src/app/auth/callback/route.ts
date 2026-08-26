import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Where Google sends the browser back to. Exchanges the one-time code for a
 * session and writes the cookies, then forwards to wherever the person was
 * originally headed.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  // Google itself can report a refusal; surface it rather than looping.
  const oauthError = searchParams.get("error_description") || searchParams.get("error");
  if (oauthError) {
    const back = new URL("/login", origin);
    back.searchParams.set("error", oauthError);
    return NextResponse.redirect(back);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const back = new URL("/login", origin);
    back.searchParams.set("error", "Sign-in is not configured on the server.");
    return NextResponse.redirect(back);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const back = new URL("/login", origin);
    back.searchParams.set("error", error.message);
    return NextResponse.redirect(back);
  }

  // Only ever redirect to a path on this origin. Taking `next` from the query
  // string and passing it to redirect() unchecked is an open redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(new URL(safeNext, origin));
}
