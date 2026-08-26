import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Who is signed in, for the client. Null rather than 401 — not being signed
 *  in is an ordinary answer to this question, not a failure. */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
