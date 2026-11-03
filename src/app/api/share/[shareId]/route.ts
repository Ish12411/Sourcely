import { NextResponse } from "next/server";
import {
  appendToConversation,
  ContributionError,
  getConversation,
  ShareError,
  ShareNotConfiguredError,
} from "@/lib/supabase";
import { getCurrentUser } from "@/lib/supabase/server";
import { isOffensive, OFFENSIVE_MESSAGE } from "@/lib/moderation";
import type { Scope, StyleId, Turn } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ shareId: string }> };

function handle(err: unknown) {
  if (err instanceof ShareNotConfiguredError) {
    return NextResponse.json({ error: err.message }, { status: 501 });
  }
  if (err instanceof ShareError || err instanceof ContributionError) {
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
 * Add follow-ups to a group thread. Anyone signed in who holds the link may
 * add; nobody but the owner may rename it, and nobody can change or remove
 * someone else's questions (see appendToConversation). Each new question is
 * stamped with its author so others can report or block it, and checked by
 * the same offensive-language filter as /api/research.
 */
export async function PUT(request: Request, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in to add to a shared thread." }, { status: 401 });
    const { shareId } = await ctx.params;
    const body = await request.json();

    const patch: Partial<{ title: string; style: StyleId; scope: Scope; turns: Turn[] }> = {};
    if (typeof body?.title === "string") patch.title = body.title.slice(0, 200);
    if (typeof body?.style === "string") patch.style = body.style as StyleId;
    if (typeof body?.scope === "string") patch.scope = body.scope as Scope;
    if (Array.isArray(body?.turns)) patch.turns = body.turns as Turn[];

    const conversation = await appendToConversation(shareId, user.id, patch, (turn) =>
      isOffensive(String(turn.question ?? "")) ? OFFENSIVE_MESSAGE : null
    );
    if (!conversation) {
      return NextResponse.json({ error: "That shared link doesn't exist any more." }, { status: 404 });
    }
    return NextResponse.json(conversation);
  } catch (err) {
    return handle(err);
  }
}
