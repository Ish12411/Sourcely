import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The commit this deployment was built from. Public and harmless. */
export function GET() {
  return NextResponse.json(
    { sha: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
