import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { banUser, listReports, removeSharedTurn, resolveReport } from "@/lib/supabase";

export const runtime = "nodejs";

/** Act on a report: remove the question, ban its author, or dismiss it. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id ?? "");
  const action = String(body?.action ?? "");

  try {
    const report = (await listReports()).find((r) => r.id === id);
    if (!report) return NextResponse.json({ error: "That report no longer exists." }, { status: 404 });

    if (action === "remove") await removeSharedTurn(report.share_id, report.turn_id);
    else if (action === "ban") {
      if (!report.author_id) return NextResponse.json({ error: "That question has no known author." }, { status: 400 });
      await removeSharedTurn(report.share_id, report.turn_id);
      await banUser(report.author_id);
    } else if (action !== "dismiss") {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    await resolveReport(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/admin/reports]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't do that." }, { status: 500 });
  }
}
