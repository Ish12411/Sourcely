import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { deleteAllThreadsFor, deleteAuthUser, ShareError, ShareNotConfiguredError } from "@/lib/supabase";

export const runtime = "nodejs";

/** Who is signed in, for the client. Null rather than 401 — not being signed
 *  in is an ordinary answer to this question, not a failure. */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}

/**
 * Permanently delete the signed-in person's account and everything in it.
 *
 * Required by App Store Review Guideline 5.1.1(v). The identity comes only from
 * the verified session — cookie on the web, bearer token in the app — never
 * from the request body, so nobody can delete an account that isn't theirs.
 * The body must carry an explicit confirmation, so a stray or replayed request
 * can't do it either.
 */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== "DELETE") {
    return NextResponse.json({ error: "Confirmation missing." }, { status: 400 });
  }

  try {
    const threadsDeleted = await deleteAllThreadsFor(user.id);
    await deleteAuthUser(user.id);
    return NextResponse.json({ deleted: true, threadsDeleted });
  } catch (err) {
    if (err instanceof ShareNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    if (err instanceof ShareError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[DELETE /api/me]", err);
    // Not "nothing was changed": threads are removed before the account, so a
    // failure here may land after some data is already gone. Retrying is safe.
    return NextResponse.json(
      { error: "Couldn't finish deleting your account. Try again — anything already removed stays removed." },
      { status: 500 }
    );
  }
}
