import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST only. A sign-out on GET would let any page log a person out by
 * embedding an image pointing at it.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 });
}
