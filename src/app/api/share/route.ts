import { NextResponse } from "next/server";
import {
  createConversation,
  ShareError,
  ShareNotConfiguredError,
} from "@/lib/supabase";
import type { Scope, StyleId, Turn } from "@/lib/types";

export const runtime = "nodejs";

/** Create a shareable conversation and return its public id. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body?.title ?? "Shared research").slice(0, 200);
    const style = String(body?.style ?? "mla9") as StyleId;
    const scope = String(body?.scope ?? "balanced") as Scope;
    const turns = Array.isArray(body?.turns) ? (body.turns as Turn[]) : [];

    const conversation = await createConversation({ title, style, scope, turns });
    return NextResponse.json(conversation);
  } catch (err) {
    if (err instanceof ShareNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    if (err instanceof ShareError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[/api/share]", err);
    return NextResponse.json({ error: "Couldn't create the share link." }, { status: 500 });
  }
}
