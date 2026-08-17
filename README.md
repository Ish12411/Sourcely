# Sourcely

Ask an academic question. Get a plain-language summary, the key points, and every source cited in whichever
style your teacher asked for — with a short summary of what each individual source contributes.

Built for students. Runs entirely on free API tiers.

## How it works

1. **Tavily** searches the web and returns the full text of the top pages.
2. **Gemini** reads those pages and writes the overview, the key points, a per-source summary, and — critically —
   extracts the *citation metadata* (authors, publication date, publisher, site name).
3. **The app itself formats the citations**, in `src/lib/citations.ts`. The model never writes a citation string.

That last point matters. Because citations are assembled deterministically from metadata:

- Switching citation style re-renders instantly, with no second API call and no extra quota used.
- The model cannot hallucinate a reference to a page that doesn't exist — every URL comes from the search results.

## Citation styles

MLA 9 · APA 7 · Chicago (Notes & Bibliography) · Chicago (Author-Date) · Turabian 9 · Harvard (Cite Them Right) ·
IEEE · Vancouver · AMA 11 · ASA 6 · APSA · CSE (Name-Year) · BibTeX export

Each source gives you both the reference-list entry and the in-text citation, each with its own copy button.
The whole reference list can be copied in one click, correctly ordered — alphabetical for author-date styles,
citation order for numeric ones.

## Conversations

Each tab is a thread, not a single question. Ask a question, read the answer, then keep asking underneath it —
the earlier questions and answers stay on the page.

Follow-ups carry memory. The last four turns are sent with each request, and a first Gemini call rewrites the
follow-up into a standalone search query before anything is searched:

| You ask | Searched as |
| --- | --- |
| "What caused World War One?" | *(unchanged — first question)* |
| "How did it affect Russia?" | "effects of World War One on Russia" |
| "Can I have more sources?" | original topic, with every already-cited URL filtered out |

That last row is a distinct intent, not a new topic. The rewriter sets `wantsMoreSources`, the search asks for a
wider net, and URLs already shown in the thread are dropped — so you get genuinely new references rather than the
same ones again. If filtering would leave fewer than three sources, it keeps the unfiltered set instead of
returning almost nothing.

## Personal and group tabs

Tabs live in a left sidebar and come in two kinds:

- **Personal** — stored only in this browser's localStorage. Nothing is uploaded.
- **Group** — synced to Supabase and reachable at `/t/<shareId>`. Anyone with the link can read the thread **and
  add their own follow-ups**.

The pencil icon on any tab opens a dialog to rename it, or to turn a personal tab into a group tab later.
Sharing offers **Copy link** and **Share by email** — the email button opens the student's own mail app with the
link pre-filled via `mailto:`, so no email service, API key or domain verification is needed.

### Supabase setup (optional)

Group tabs need one table. Create a free project at [supabase.com](https://supabase.com), then run this in the
SQL editor:

```sql
create table conversations (
  id          uuid primary key default gen_random_uuid(),
  share_id    text unique not null,
  title       text not null,
  style       text not null,
  scope       text not null,
  turns       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index conversations_share_id_idx on conversations (share_id);

-- The browser never talks to Supabase directly, so public access stays off.
alter table conversations enable row level security;
```

Leaving RLS on with **no policies** is deliberate. All access goes through this app's own `/api/share` routes
using the `service_role` key, which bypasses RLS server-side and only ever looks a row up by its unguessable
share id. No Supabase key of any kind is shipped to the browser.

Then add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`.

**Two things worth knowing before you share a link:**

- The link *is* the password. There are no accounts, so anyone who receives or forwards it gets the same access.
- Anyone with the link can ask follow-ups, and those run against **your** Tavily and Gemini quota.

## Source scope

A second dropdown next to the citation style controls which corner of the web gets searched:

| Scope | Behaviour |
| --- | --- |
| **Balanced** (default) | Excludes video, social and homework-help sites — YouTube, Reddit, Quizlet, Chegg, SparkNotes, CourseHero and ~40 others |
| **Academic & official** | Restricts to `*.edu`, `*.gov` and `*.ac.uk`, with the balanced exclusions still applied |
| **Everything** | No filtering |

### Why academic mode has a fallback

Tavily's `include_domains` is not reliable, measured against the live API:

- A bare suffix like `".edu"` is **accepted but silently does not filter** — it returned scribd.com and study.com. Only the `"*.edu"` wildcard form works.
- Results are **not deterministic**. The same five-wildcard list returned zero results on three consecutive calls and eight on a later probe; a four-item list returned zero while a five-item superset of it returned eight.
- Mixing wildcards with specific domains collapses the result set — adding `britannica.com` to a wildcard list returned britannica.com for all eight slots.

So `ACADEMIC_INCLUDE` in [src/lib/tavily.ts](src/lib/tavily.ts) is deliberately kept to three wildcards, and `searchWithScope` checks the result count. If academic mode comes back with fewer than four sources it reruns without the include filter and sets `scopeFellBack`, which shows the student a banner explaining what happened. It never silently pretends the filter worked, and never leaves them with nothing.

## Setup

Requires **Node.js 20.9 or newer**.

```bash
npm install
```

Copy the example env file and paste in your two keys:

```bash
cp .env.local.example .env.local
```

| Variable | Where to get it | Free tier |
| --- | --- | --- |
| `TAVILY_API_KEY` | https://app.tavily.com | Monthly search credits, no card |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | Daily request quota, no card |

Optional:

- `GEMINI_MODEL` — defaults to `gemini-3.5-flash-lite`. See the quota note below before changing it.
- `MAX_SOURCES` — how many pages to search and read. Defaults to `8`. Lower it to spend less quota per question.

Then:

```bash
npm run dev
```

Open http://localhost:3000.

### Which Gemini model, and why it matters

The free tier's binding constraint is **requests per day, counted separately for each model** — not tokens, and
not requests per minute. Measured against the live API rather than taken from the docs:

```
gemini-3.6-flash -> HTTP 429
  quotaId:    GenerateRequestsPerDayPerProjectPerModel-FreeTier
  quotaValue: 20
```

Twenty requests a day. A first question costs one call and a context-dependent follow-up costs two, so that's
roughly ten questions before the model is unavailable until the quota resets. The default is therefore
`gemini-3.5-flash-lite`, which has its own much larger allowance and answered noticeably faster in testing
(~8s vs ~33s per question).

Because the quota is per model, switching models gives you a fresh bucket — useful if you exhaust one mid-session.

To keep questions cheap, the follow-up rewrite call is skipped when it isn't needed: a question with no pronouns
that is long enough to stand alone is searched as typed, and "can I have more sources?" is recognised by pattern
rather than by asking the model.

## Keys stay on the server

Both keys are read in `src/app/api/research/route.ts`, which runs server-side only. Neither is prefixed with
`NEXT_PUBLIC_`, so neither is ever sent to the browser. `.env.local` is gitignored.

## Deploying to Vercel

Vercel's Hobby tier covers this app at no cost. Nothing needs configuring beyond environment variables —
there is no `vercel.json`, because Vercel detects Next.js and gets every default right on its own.

**1. Push to GitHub**

```bash
git remote add origin https://github.com/<you>/sourcely.git
git branch -M main
git push -u origin main
```

**2. Import at [vercel.com/new](https://vercel.com/new)** and pick the repo. Framework, build command and
output directory are all detected automatically.

**3. Add the environment variables** under *Settings → Environment Variables*, for the Production,
Preview and Development environments:

| Variable | Required | Notes |
| --- | --- | --- |
| `TAVILY_API_KEY` | yes | Without it, every search fails |
| `GEMINI_API_KEY` | yes | Without it, every search fails |
| `SUPABASE_URL` | only for group tabs | Personal tabs work without it |
| `SUPABASE_SERVICE_ROLE_KEY` | only for group tabs | Never prefix with `NEXT_PUBLIC_` |
| `GEMINI_MODEL` | no | Defaults to `gemini-3.5-flash-lite` |
| `MAX_SOURCES` | no | Defaults to `8` |

The build itself needs none of these — it is verified to compile with the entire `.env.local` absent, so a
missing variable shows up as a clear runtime error rather than a failed deploy. Omitting the Supabase pair
degrades gracefully: sharing reports that it isn't configured and everything else keeps working.

**4. Redeploy after adding variables.** Vercel does not apply new environment variables to an existing
build.

### Notes for a live deployment

- **Share links use the deployed origin.** They are built from `window.location.origin`, so they point at
  your Vercel domain automatically with nothing to configure.
- **Anyone holding a share link spends your API quota.** There are no accounts; the link is the credential.
  Both free tiers are per-key and shared across every visitor.
- **`maxDuration` is 120s** on the research route. Hobby permits up to 300s if you find follow-ups timing
  out under heavy rate limiting.

## Project layout

```
src/
  app/
    layout.tsx               Newsreader / IBM Plex Sans / IBM Plex Mono
    globals.css              @theme design tokens
    page.tsx                 -> Workspace
    t/[shareId]/page.tsx     shared thread -> Workspace
    api/research/route.ts    search → model → normalised result
    api/share/**             create / read / update a shared thread
  components/
    Workspace.tsx            three-column shell, shortcuts, empty state
    Sidebar.tsx              thread list; 228px expanded, 48px collapsed
    Thread.tsx               per-turn eyebrow, heading, loading, error
    ResultsView.tsx          prose, key points, caveats, superscript markers
    SourcesRail.tsx          rail header, style/scope, copy-all, grouping
    SourceCard.tsx           numbered card, hanging-indent citation
    Composer.tsx             the question field
    TabEditDialog.tsx        rename, group toggle, share link
  lib/
    citations.ts             every citation style, pure functions
    threadSources.ts         thread-wide stable source numbering
    tavily.ts                search client
    gemini.ts                model client + response schema
    useTabs.ts               thread state, persisted to localStorage
    types.ts
```

## The visual design

Three columns that scroll independently: threads on the left, the reading column centred at 620px, and a
sources-and-citations rail on the right. The type system carries the idea — serif (Newsreader) for anything the
student *reads*, sans (IBM Plex Sans) for UI, and **mono (IBM Plex Mono) for every citation string and every piece
of source metadata**. The mono is the visual signal that a citation was assembled deterministically from metadata
rather than written by the model.

Superscript markers in the prose are buttons: clicking one scrolls the matching card in the rail into view and
flashes its border. Source numbering is **thread-wide and stable** — assigned on first appearance in
`threadSources.ts` — so a marker in question 1 still resolves after question 3 appends more sources. Duplicate
URLs across turns collapse onto the number they were first given.

`⌘\` / `Ctrl+\` collapses the sidebar to a 48px spine (persisted); `N` starts a new thread. Below 1280px the rail
becomes an overlay panel opened by a floating "Sources" button.

The design specifies one paper palette, so the app sets `color-scheme: light` rather than inventing an
undesigned dark theme.

## Adding a Claude API key later

`src/lib/gemini.ts` exposes a single `geminiJson({ system, prompt, schema })` function, and the route calls it
once. To move the synthesis step to Claude, write an equivalent `claudeJson` with the same signature — Claude's
tool-use API can enforce the same JSON shape — and swap the call in `src/app/api/research/route.ts`. Nothing
in the citation layer or the UI needs to change.

## Honest limitations

- Citations are only as good as the metadata on the page. Pages that hide their author or date produce
  incomplete entries — the app shows what it found, and the UI tells students to check.
- Tavily searches the open web, not paywalled journal databases. Academic scope narrows to university and
  government sites, but for a serious paper this is still a starting point for finding sources rather than a
  replacement for your library's databases.
- The reliability ratings are a heuristic nudge from a language model, not an authoritative judgement.
- Gemini's free tier returns 503 "overloaded" and 429 "rate limited" fairly often. `geminiJson` retries both with
  backoff, but under sustained load a request can still fail; the UI offers a Try again button.
