import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms — Sourcely",
  description: "The rules for using Sourcely, including group threads.",
};

const CONTACT_EMAIL = "ishrao1204@hotmail.com";
const UPDATED = "November 2, 2026";

/*
  Required by App Store Guideline 1.2 for apps with user-generated content:
  people must agree to terms that make clear there is no tolerance for
  objectionable content or abusive users. Sign-up links here, and every claim
  matches what the app does: the filter (lib/moderation.ts), Report and Block
  (ModerationDialog), and the reports queue at /admin.
*/
export default function TermsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--color-paper)" }}>
      <article
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding:
            "calc(48px + var(--safe-top)) max(22px, var(--safe-right)) calc(64px + var(--safe-bottom)) max(22px, var(--safe-left))",
        }}
      >
        <a href="/" className="ink-action" style={{ fontSize: "var(--step-label)" }}>
          ← Back to Sourcely
        </a>
        <h1 className="display" style={{ marginTop: 22 }}>
          Terms
        </h1>
        <p className="mono-meta" style={{ marginTop: 10 }}>
          Last updated {UPDATED}
        </p>

        <Section title="Using Sourcely">
          <P>
            Sourcely is a research tool for students aged 13 and over. By creating an account you agree to these terms
            and to the <a href="/privacy">privacy policy</a>. Answers are written by AI from the sources it finds and
            can contain mistakes, so check anything important against the cited sources before relying on it.
          </P>
        </Section>

        <Section title="No tolerance for objectionable content or abuse">
          <P>
            Group threads let other people see your questions. You must not post anything hateful, harassing,
            threatening, sexual, violent, or otherwise objectionable, and you must not use Sourcely to target or abuse
            anyone. There is no tolerance for this.
          </P>
          <List
            items={[
              ["Filtering.", "Questions containing offensive language are refused before they are searched or shared."],
              ["Reporting.", "Tap Report under any question someone else added to report it. It is hidden from you straight away."],
              ["Blocking.", "Tap Block to hide everything a person adds, in every thread, and stop them adding to your threads."],
              ["Review.", "Every report is reviewed within 24 hours. Content that breaks these rules is removed, and the account that posted it is banned from Sourcely."],
            ]}
          />
        </Section>

        <Section title="Your account">
          <P>
            You can delete your account and everything in it at any time, from the bottom of the sidebar. Sourcely may
            suspend or remove accounts that break these terms.
          </P>
        </Section>

        <Section title="Contact">
          <P>
            Report a problem, appeal a decision, or ask anything:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--color-ink)" }}>
              {CONTACT_EMAIL}
            </a>
            .
          </P>
        </Section>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 40 }}>
      <h2 className="title" style={{ marginBottom: 12 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="prose" style={{ margin: "0 0 14px" }}>
      {children}
    </p>
  );
}

function List({ items }: { items: Array<[string, string]> }) {
  return (
    <ul style={{ margin: "0 0 14px", padding: 0, listStyle: "none" }}>
      {items.map(([lead, rest]) => (
        <li key={lead} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <span
            aria-hidden="true"
            style={{ flex: "none", width: 5, height: 5, marginTop: "0.72em", borderRadius: 99, background: "var(--color-mark)" }}
          />
          <span className="prose">
            <strong style={{ color: "var(--color-ink)", fontWeight: 700 }}>{lead}</strong> {rest}
          </span>
        </li>
      ))}
    </ul>
  );
}
