import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — Sourcely",
  description: "What Sourcely collects, who processes it, and how to delete it.",
};

/**
 * The address people use to reach you about their data. Apple checks that the
 * privacy policy and support URL both lead to a working contact. Set this
 * before submitting to the App Store; until then the page says so rather than
 * showing an address that doesn't exist.
 */
const CONTACT_EMAIL = "";

const UPDATED = "September 25, 2026";

/*
  Written from what the code actually does, not from a template. Every claim
  here maps to a real behaviour: the tables in lib/supabase.ts, the providers
  called in api/research/route.ts, the localStorage key in lib/useTabs.ts, and
  the deletion route in api/me/route.ts. If any of those change, this page is
  now wrong and has to change with them.
*/

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--color-paper)" }}>
      <article
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "calc(48px + var(--safe-top)) 22px calc(64px + var(--safe-bottom))",
        }}
      >
        <a href="/" className="ink-action" style={{ fontSize: "var(--step-label)" }}>
          ← Back to Sourcely
        </a>

        <h1 className="display" style={{ marginTop: 22 }}>
          Privacy
        </h1>
        <p className="mono-meta" style={{ marginTop: 10 }}>
          Last updated {UPDATED}
        </p>

        <Section title="The short version">
          <P>
            Sourcely stores your email address and the research you do, so your threads are there when you sign in.
            To answer a question it sends that question to two outside services — a search engine and Google&apos;s
            Gemini AI. Google may use what it receives to improve its products, and people at Google may read it.{" "}
            <strong>Don&apos;t put personal or sensitive information in your questions.</strong> There are no ads, no
            tracking, and nothing is sold. You can delete your account and everything in it from inside the app at any
            time.
          </P>
        </Section>

        <Section title="What Sourcely collects">
          <List
            items={[
              [
                "Your account.",
                "Your email address. Your password is handled by our sign-in provider and stored only as a secure hash — Sourcely never sees it. If you sign in with Google on the website, Google shares your email address with us.",
              ],
              [
                "Your research.",
                "The questions you ask, the answers and key points generated for them, the sources found, and your chosen citation style and search scope. These are saved to your account as threads.",
              ],
              [
                "On your device.",
                "A working copy of your threads is kept in your browser's local storage so the app responds instantly. It stays on that device and is cleared when you delete your account.",
              ],
            ]}
          />
          <P>
            Sourcely does not collect your location, contacts, photos, or any identifier used to track you across other
            apps and websites. There is no advertising, no analytics tracking, and your information is never sold.
          </P>
        </Section>

        <Section title="Who else handles it">
          <P>These services process data to make Sourcely work. Each only receives what it needs.</P>
          <List
            items={[
              ["Supabase", "hosts your account and saved threads."],
              ["Vercel", "hosts the app. Like any web host, it keeps standard technical logs of requests."],
              ["Tavily", "receives the text of your question to search the web for sources."],
              [
                "Google (Gemini API)",
                "receives your question, the text of the web pages found, and earlier questions in the same thread, and writes the answer. Sourcely uses Gemini's free tier, under which Google may use this content to improve its products, and human reviewers at Google may read it.",
              ],
            ]}
          />
        </Section>

        <Section title="Shared threads">
          <P>
            If you make a thread a group thread, anyone who has its link can read it and add their own follow-up
            questions. There is no separate password — the link itself is what grants access, so share it only with
            people you trust.
          </P>
        </Section>

        <Section title="Deleting your data">
          <P>
            You can delete any single thread from the app. To delete everything, choose <strong>Delete account</strong>{" "}
            at the bottom of the sidebar. This permanently removes your account and every thread in it, including shared
            ones — anyone you sent a link to will lose access. It cannot be undone.
          </P>
          <P>
            Deleting your account removes your data from Sourcely. It can&apos;t recall text that was already sent to
            Tavily or Google to answer a question; that is governed by their own privacy policies.
          </P>
        </Section>

        <Section title="Children">
          <P>
            Sourcely is built for high school and university students and is not intended for children under 13. If you
            believe a child under 13 has created an account, contact us and it will be deleted.
          </P>
        </Section>

        <Section title="Changes">
          <P>
            If this policy changes, the date at the top will change with it. Significant changes will be noted in the
            app.
          </P>
        </Section>

        <Section title="Contact" id="contact">
          {CONTACT_EMAIL ? (
            <P>
              Questions about your data, or anything else:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--color-ink)" }}>
                {CONTACT_EMAIL}
              </a>
              .
            </P>
          ) : (
            <P>A contact address will be listed here.</P>
          )}
        </Section>
      </article>
    </main>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginTop: 40, scrollMarginTop: 24 }}>
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
            style={{
              flex: "none",
              width: 5,
              height: 5,
              marginTop: "0.72em",
              borderRadius: 99,
              background: "var(--color-mark)",
            }}
          />
          <span className="prose">
            <strong style={{ color: "var(--color-ink)", fontWeight: 700 }}>{lead}</strong> {rest}
          </span>
        </li>
      ))}
    </ul>
  );
}
