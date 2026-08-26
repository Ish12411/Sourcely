# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Students, high school leading. The primary user is 14–18, working on one specific assigned
task — a set essay, a History Day project, a science write-up — and is usually working
close to a deadline. Undergraduates are a real secondary audience: more sources per
project, more likely to need APA, Chicago or IEEE, more sensitive to source credibility.

The design is aimed at the high schooler first — clearer guidance on what is actually
citable — without reading as juvenile to an undergraduate.

The defining scene: someone who has been told to "use five sources and cite them properly",
who does not yet know what makes a source citable, and who is discovering that the hard
part is not finding an answer but proving where it came from.

## Product Purpose

Ask an academic question and get three things at once: a plain-language answer, the key
points behind it, and every source cited in whichever style the teacher demanded — with a
short summary of what each individual source actually contributes.

Success is a student finishing with a works-cited list they can paste in and defend, having
read the sources rather than laundered them.

## Positioning

Citations are assembled deterministically by the application from metadata the model
extracted, not written by the model. The model never emits a citation string.

Two consequences a neighbouring "AI research assistant" cannot truthfully copy while it has
the model write citations:

- Switching citation style re-renders instantly, with no second API call and no extra quota.
- A reference cannot point at a page that does not exist — every URL comes from the search
  results, never from the model.

Source credibility is surfaced as a first-class fact, not hidden: every source carries a
reliability rating, a one-line reason, and explicit NO AUTHOR FOUND / NO DATE FOUND badges
when the page cannot support a complete citation.

## Operating Context

- One thread per assignment. A thread is a conversation: ask, read, ask a follow-up. Later
  questions carry memory of the earlier ones, so "how did that affect Russia?" resolves.
- Threads are personal (this browser only) or group (synced, reachable by link, and anyone
  holding the link can add follow-ups).
- The end of the workflow is always a clipboard: copy one entry, copy an in-text citation,
  or copy the whole reference list in the required style.
- Long reading sessions on a laptop, frequently at night, frequently under deadline.

## Capabilities and Constraints

- Next.js 16 (App Router), React 19, Tailwind 4, TypeScript. Deployed on Vercel Hobby.
- Tavily for search; Google Gemini for synthesis and metadata extraction. Both free tiers,
  both rate-limited, both shared by every visitor to a deployment.
- 13 citation styles: MLA 9, APA 7, Chicago (Notes-Bibliography and Author-Date), Turabian 9,
  Harvard, IEEE, Vancouver, AMA 11, ASA 6, APSA, CSE, plus BibTeX export.
- Three source scopes: Balanced (excludes video, social and homework-help sites), Academic
  (`*.edu`, `*.gov`, `*.ac.uk`), Everything. Academic mode falls back and says so when the
  domain filter returns too little — Tavily's `include_domains` is measurably unreliable.
- Group sharing needs Supabase; without it the app still runs and reports sharing as
  unconfigured rather than failing.
- Search latency is 20–40 seconds. The waiting state is a real, frequent screen, not an edge
  case.

## Brand Commitments

- The name **Sourcely** is fixed, as is the superscript-numeral mark in the wordmark, which
  reads as a citation marker.
- A warm paper ground is pinned by the owner and must survive the redesign.
- Accent colours are explicitly NOT pinned and may be replaced.
- Voice: plain, exact, unpatronising. It tells a student when a source is weak rather than
  flattering the result.

## Evidence on Hand

- A working application with real output; every screen can be shown with genuine data.
- No customers, no testimonials, no usage numbers, no institutional endorsement. None exist
  and none may be fabricated.
- Measured facts that future work may rely on: the search pipeline returns 5–13 sources per
  question; a bare `.edu` suffix filter silently fails at Tavily while `*.edu` works; the
  same wildcard list has returned both 0 and 8 results on consecutive calls.

## Product Principles

1. **The citation is the product.** Everything else is scaffolding around producing a
   correct, paste-ready reference.
2. **Show the seams.** Missing authors, missing dates, weak sources and a fallen-back search
   scope are all stated plainly. A student's trust is worth more than a clean-looking list.
3. **Never let the model author a fact the app can derive.** Determinism where determinism is
   possible.
4. **The thread is the unit of work,** not the question. Follow-ups are the normal case.
5. **Free tiers are a shared, finite resource.** Do not spend a request the app can avoid.

## Accessibility & Inclusion

WCAG AA. Body text at 4.5:1 or better, visible keyboard focus throughout, full keyboard
navigation, and `prefers-reduced-motion` respected. Used in schools, so this is a floor and
not an aspiration.
