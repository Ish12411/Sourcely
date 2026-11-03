import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { findSharedTurn, saveReport } from "@/lib/supabase";

export const runtime = "nodejs";

const REASONS = ["offensive", "harassment", "sexual", "spam", "other"] as const;

/**
 * Report a question someone else added to a group thread (App Store Guideline
 * 1.2). The report is stored for review; the client also hides the question
 * from the reporter straight away. Reports are checked against the stored
 * thread, so only real questions in a real thread can be reported, and the
 * author recorded with the report comes from the server, not the client.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to report something." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const shareId = String(body?.shareId ?? "");
  const turnId = String(body?.turnId ?? "");
  const reason = REASONS.includes(body?.reason) ? (body.reason as string) : "other";
  const note = String(body?.note ?? "").slice(0, 1000);
  if (!shareId || !turnId) return NextResponse.json({ error: "Nothing to report." }, { status: 400 });

  try {
    const turn = await findSharedTurn(shareId, turnId);
    if (!turn) return NextResponse.json({ error: "That question no longer exists." }, { status: 404 });

    const record = {
      reporter_id: user.id,
      share_id: shareId,
      turn_id: turnId,
      author_id: turn.authorId ?? null,
      reason,
      note,
      question: String(turn.question ?? "").slice(0, 500),
    };
    const stored = await saveReport(record);
    // Always in the server log too, so a report is never lost even if the
    // reports table is missing.
    console.warn("[report]", JSON.stringify({ ...record, stored, at: new Date().toISOString() }));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/report]", err);
    return NextResponse.json({ error: "Couldn't send that report. Try again." }, { status: 500 });
  }
}
