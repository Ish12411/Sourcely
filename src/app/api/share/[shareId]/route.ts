import { NextResponse } from "next/server";
import {
  getConversation,
  updateConversation,
  ShareError,
  ShareNotConfiguredError,
} from "@/lib/supabase";
import type { Scope, StyleId, Turn } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ shareId: string }> };

function handle(err: unknown) {
  if (err instanceof ShareNotConfiguredError) {
    return NextResponse.json({ error: err.message }, { status: 501 });
  }
  if (err instanceof ShareError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[/api/share/:id]", err);
  return NextResponse.json({ error: "Couldn't reach the shared conversation." }, { status: 500 });
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { shareId } = await ctx.params;
    const conversation = await getConversation(shareId);
    if (!conversation) {
      return NextResponse.json({ error: "That shared link doesn't exist any more." }, { status: 404 });
    }
    return NextResponse.json(conversation);
  } catch (err) {
    return handle(err);
  }
}

/**
 * Anyone holding the link may add follow-ups, so this accepts writes without
 * auth by design. The share id is the capability.
 */
export async function PUT(request: Request, ctx: Ctx) {
  try {
    const { shareId } = await ctx.params;
    const body = await request.json();

    const patch: Partial<{ title: string; style: StyleId; scope: Scope; turns: Turn[] }> = {};
    if (typeof body?.title === "string") patch.title = body.title.slice(0, 200);
    if (typeof body?.style === "string") patch.style = body.style as StyleId;
    if (typeof body?.scope === "string") patch.scope = body.scope as Scope;
    if (Array.isArray(body?.turns)) patch.turns = body.turns as Turn[];

    const conversation = await updateConversation(shareId, patch);
    if (!conversation) {
      return NextResponse.json({ error: "That shared link doesn't exist any more." }, { status: 404 });
    }
    return NextResponse.json(conversation);
  } catch (err) {
    return handle(err);
  }
}
