import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { listReports, type StoredReport } from "@/lib/supabase";
import ReportActions from "@/components/ReportActions";

export const metadata: Metadata = { title: "Reports — Sourcely" };
export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  offensive: "Offensive or hateful",
  harassment: "Harassment or bullying",
  sexual: "Sexual content",
  spam: "Spam or nonsense",
  other: "Something else",
};

/**
 * The developer's moderation queue. Anyone not on ADMIN_EMAILS gets a plain
 * 404, so the page doesn't advertise that it exists.
 */
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) notFound();

  let reports: StoredReport[] = [];
  let tableMissing = false;
  try {
    reports = await listReports();
  } catch {
    tableMissing = true;
  }
  const open = reports.filter((r) => !r.resolved_at);

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-paper)" }}>
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding:
            "calc(40px + var(--safe-top)) max(20px, var(--safe-right)) calc(48px + var(--safe-bottom)) max(20px, var(--safe-left))",
        }}
      >
        <a href="/" className="ink-action" style={{ fontSize: "var(--step-label)" }}>
          ← Back to Sourcely
        </a>
        <h1 className="display" style={{ marginTop: 18 }}>
          Reports
        </h1>
        <p className="mono-meta" style={{ marginTop: 8 }}>
          {tableMissing ? "reports table not set up" : `${open.length} open · ${reports.length - open.length} resolved`}
        </p>

        {tableMissing && (
          <p className="prose" style={{ marginTop: 20 }}>
            The <code>reports</code> table doesn&apos;t exist yet. Run the SQL in <code>DEPLOY.md</code> (section
            &ldquo;Reports table&rdquo;) in the Supabase SQL Editor. Until then, reports are still written to the Vercel
            logs, tagged <code>[report]</code>.
          </p>
        )}

        {!tableMissing && reports.length === 0 && (
          <p className="prose" style={{ marginTop: 20 }}>
            No reports yet.
          </p>
        )}

        <div style={{ marginTop: 24, display: "grid", gap: 14 }}>
          {reports.map((r) => (
            <article
              key={r.id}
              style={{
                padding: 16,
                background: r.resolved_at ? "transparent" : "var(--color-paper-raised)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius-control)",
                opacity: r.resolved_at ? 0.6 : 1,
              }}
            >
              <div className="mono-meta" style={{ display: "flex", gap: 12, flexWrap: "wrap", color: "var(--meta)" }}>
                <span>{new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                <span style={{ color: "var(--color-mark)" }}>{REASON_LABEL[r.reason] ?? r.reason}</span>
                {r.resolved_at && <span>resolved</span>}
              </div>
              <p style={{ margin: "10px 0 0", font: "400 1.0625rem/1.45 var(--font-serif)", color: "var(--color-ink)" }}>
                “{r.question}”
              </p>
              {r.note && (
                <p className="prose" style={{ margin: "8px 0 0", fontSize: "0.875rem" }}>
                  Reporter&apos;s note: {r.note}
                </p>
              )}
              <p className="mono-meta" style={{ margin: "10px 0 0", color: "var(--meta-dim)", wordBreak: "break-all" }}>
                author {r.author_id ?? "unknown"} · thread <a href={`/t/${r.share_id}`}>/t/{r.share_id}</a>
              </p>
              {!r.resolved_at && <ReportActions id={r.id} canBan={Boolean(r.author_id)} />}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
