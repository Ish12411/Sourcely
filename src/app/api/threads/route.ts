import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  listThreads,
  upsertThread,
  ShareError,
  ShareNotConfiguredError,
} from "@/lib/supabase";
import type { Scope, StyleId, Turn } from "@/lib/types";

export const runtime = "nodejs";

function handle(err: unknown) {
  if (err instanceof ShareNotConfiguredError) {
    return NextResponse.json({ error: err.message }, { status: 501 });
  }
  if (err instanceof ShareError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[/api/threads]", err);
  return NextResponse.json({ error: "Couldn't reach your threads." }, { status: 500 });
}

/** Every thread belonging to the signed-in person. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    return NextResponse.json({ threads: await listThreads(user.id) });
  } catch (err) {
    return handle(err);
  }
}

/**
 * Create or update one thread. The owner is taken from the verified session,
 * never from the request body — a client-supplied owner id would let anyone
 * write into anyone else's account.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const body = await request.json();
    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "A thread id is required." }, { status: 400 });

    const thread = await upsertThread({
      id,
      ownerId: user.id,
      title: String(body?.title ?? "Untitled research").slice(0, 200),
      style: String(body?.style ?? "mla9") as StyleId,
      scope: String(body?.scope ?? "balanced") as Scope,
      turns: Array.isArray(body?.turns) ? (body.turns as Turn[]) : [],
    });

    return NextResponse.json(thread);
  } catch (err) {
    return handle(err);
  }
}
