import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  deleteThread,
  shareOwnedThread,
  ShareError,
  ShareNotConfiguredError,
} from "@/lib/supabase";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function handle(err: unknown) {
  if (err instanceof ShareNotConfiguredError) {
    return NextResponse.json({ error: err.message }, { status: 501 });
  }
  if (err instanceof ShareError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[/api/threads/:id]", err);
  return NextResponse.json({ error: "Couldn't update that thread." }, { status: 500 });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const { id } = await ctx.params;
    await deleteThread(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}

/** Give this thread a share link. Only its owner can. */
export async function POST(_request: Request, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const { id } = await ctx.params;
    const shareId = await shareOwnedThread(id, user.id);
    if (!shareId) {
      return NextResponse.json(
        { error: "That thread doesn't exist, or isn't yours to share." },
        { status: 404 }
      );
    }
    return NextResponse.json({ shareId });
  } catch (err) {
    return handle(err);
  }
}
