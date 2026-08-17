import { NextResponse } from "next/server";
import { searchWithScope, excerpt, TavilyError, type TavilyResult } from "@/lib/tavily";
import {
  geminiJson,
  GeminiError,
  RESEARCH_SCHEMA,
  FOLLOWUP_SCHEMA,
  SOURCES_ONLY_SCHEMA,
} from "@/lib/gemini";
import type { Author, HistoryTurn, ResearchResult, Scope, Source } from "@/lib/types";

export const runtime = "nodejs";
/**
 * A follow-up runs two Gemini calls plus an advanced Tavily search, which has
 * measured at 20-40s and can run longer under free-tier rate limiting. Vercel's
 * Hobby ceiling is 300s, so this leaves real headroom without waiting forever
 * on a genuinely stuck request.
 */
export const maxDuration = 120;

/** Only the most recent turns are worth the tokens. */
const HISTORY_LIMIT = 4;

const SYSTEM = `You are a research assistant for students. You are given a question and a numbered set of web sources.

Rules you must follow:
- Ground every claim in the supplied sources. Never introduce facts that are not in them.
- If the sources genuinely do not answer the question, say so plainly in the overview rather than guessing.
- Write for a capable high-school or undergraduate reader: clear, specific, no padding, no hedging filler.
- Never write out a formatted citation. Extract citation METADATA only; the application formats citations itself.
- Attribute contested claims ("According to X...") rather than stating one side as settled fact.

If EARLIER CONVERSATION is supplied, this is a follow-up question:
- Read it so pronouns and shorthand in the new question resolve correctly ("it", "that war", "how did that affect...").
- Do not repeat what you already covered. Build on it, and refer back briefly where it helps ("As covered above, ...").
- The sources below are freshly retrieved for THIS question. Number them as given here, starting from 1.

For each source you must extract:
- authors: the people or organisation credited. Use "First Middle Last" order for people and set isOrganization false. For a corporate author ("NASA", "World Health Organization", "BBC News") use the name verbatim and set isOrganization true. If the page credits nobody, return an empty array — do NOT invent an author.
- title: the article/page title in title case, without the site name appended.
- titleSentenceCase: the same title in sentence case (only the first word and proper nouns capitalised).
- siteName: the website or publication it appears in, e.g. "Encyclopaedia Britannica", "Nature", "BBC News".
- publisher: the organisation behind the site. Often identical to siteName; repeat it if so.
- publishedDate: "YYYY-MM-DD", or "YYYY-MM", or "YYYY" if only the year is known, or "" if the page gives no date. Never guess a date.
- kind: a two-or-three word label, e.g. "Encyclopedia", "Peer-reviewed study", "News report", "Government agency", "University page", "Advocacy group", "Blog post".
- reliability: "high" for peer-reviewed work, government agencies, major reference works and established news organisations; "medium" for general-interest sites, textbook summaries and trade press; "low" for anonymous blogs, content farms, SEO pages and openly partisan advocacy.
- reliabilityNote: one short sentence a student can act on, explaining the rating and any bias to watch for.
- summary: 2-3 sentences on what THIS source specifically contributes to the question, and where it differs from the others. Do not just restate the overview.
- used: true if the source informed your overview or key points, false if it was off-topic or redundant.

Also produce:
- overview: 2-3 paragraphs of flowing prose that actually answers the question. Cite source numbers inline as [1], [2] where a claim comes from a specific source.
- keyPoints: 5-9 bullet points, each a complete standalone sentence with its source number(s) in brackets.
- caveats: 1-4 short notes on disagreement between sources, gaps in the evidence, or where a student should be careful. Empty array only if there genuinely are none.
- followUps: 3 sharper follow-up questions that would deepen the research. If this is already a follow-up, suggest genuinely new directions rather than repeating earlier suggestions.`;

const SOURCES_ONLY_SYSTEM = `You are a research assistant for students. The student has already been given an answer to their question and is now asking only for ADDITIONAL SOURCES on the same topic.

Do not answer the question again. Do not summarise the topic. Your entire job is to describe the supplied sources so the student can decide which ones to read and cite.

For each source, extract:
- authors: the people or organisation credited. Use "First Middle Last" order for people and set isOrganization false. For a corporate author ("NASA", "World Health Organization", "BBC News") use the name verbatim and set isOrganization true. If the page credits nobody, return an empty array — do NOT invent an author.
- title: the article/page title in title case, without the site name appended.
- titleSentenceCase: the same title in sentence case (only the first word and proper nouns capitalised).
- siteName: the website or publication it appears in.
- publisher: the organisation behind the site. Often identical to siteName; repeat it if so.
- publishedDate: "YYYY-MM-DD", "YYYY-MM", or "YYYY", or "" if the page gives no date. Never guess a date.
- kind: a two-or-three word label, e.g. "Encyclopedia", "Peer-reviewed study", "Government agency".
- reliability: "high" for peer-reviewed work, government agencies, major reference works and established news organisations; "medium" for general-interest sites and trade press; "low" for anonymous blogs, content farms and openly partisan advocacy.
- reliabilityNote: one short sentence a student can act on.
- summary: 2-3 sentences on what THIS source covers and what it adds beyond the sources already cited earlier in the conversation. Say plainly if it largely repeats ground already covered.
- used: true if the source is genuinely relevant to the topic, false if it is off-topic. Set false generously — a short list of relevant sources beats a padded one.

Write no prose outside these fields.`;

const FOLLOWUP_SYSTEM = `You rewrite a student's follow-up question into a standalone web-search query.

Given the earlier conversation and the new question, produce:
- searchQuery: a self-contained search query. Resolve every pronoun and piece of shorthand using the earlier conversation. "How did it affect Russia?" after a question about World War One becomes "effects of World War One on Russia". If the new question is already self-contained, return it close to unchanged. Never return a question that still depends on context.
- wantsMoreSources: true when the student is asking for ADDITIONAL or DIFFERENT sources on ground already covered rather than asking something new — "can I have more sources", "any other references", "find me different ones", "more academic sources". In that case searchQuery should restate the ORIGINAL topic, since the goal is fresh sources on the same subject.

Return nothing else.`;

type ModelSource = {
  index: number;
  used: boolean;
  summary: string;
  kind: string;
  reliability: "high" | "medium" | "low";
  reliabilityNote: string;
  title: string;
  titleSentenceCase: string;
  authors: Author[];
  siteName: string;
  publisher: string;
  publishedDate: string;
};

type ModelResponse = {
  overview: string;
  keyPoints: string[];
  caveats: string[];
  followUps: string[];
  sources: ModelSource[];
};

/** "www.britannica.com" -> "britannica.com", used as a siteName fallback. */
function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Rewrite the model's inline [n] markers to the final source numbering, and
 * drop markers pointing at sources that didn't make the cut. Without this a
 * dropped source shifts every later number and misattributes claims.
 */
function remapMarkers(text: string, map: Map<number, number>): string {
  return text
    .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_whole, inner: string) => {
      const mapped = inner
        .split(",")
        .map((n) => map.get(Number(n.trim())))
        .filter((n): n is number => typeof n === "number");
      if (mapped.length === 0) return "";
      const unique = [...new Set(mapped)].sort((a, b) => a - b);
      return `[${unique.join(", ")}]`;
    })
    // Tidy the gaps a removed marker leaves behind: " ." and " ," and doubled spaces.
    .replace(/\s+([.,;:)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * "Can I have more sources?" and friends. Detected locally so it costs no
 * model call — the free tier's per-day request quota is the scarce resource.
 */
const MORE_SOURCES_RE =
  /\b(more|other|another|different|additional|extra|new)\b[^.?!]{0,30}\b(sources?|references?|citations?|links?|articles?|studies)\b/i;

/**
 * Words that make a question depend on what came before. If none appear and
 * the question is long enough to stand alone, we can skip the rewrite call
 * and search it as typed.
 */
const CONTEXT_RE =
  /\b(it|its|it's|that|this|they|them|their|those|these|he|she|his|her|there|then|also|instead|same|above|earlier|previous)\b/i;

function needsRewrite(question: string): boolean {
  const words = question.trim().split(/\s+/).length;
  return CONTEXT_RE.test(question) || words < 6;
}

function renderHistory(history: HistoryTurn[]): string {
  return history
    .map((turn, i) => {
      const cited = turn.sources
        .map((s) => `  - ${s.title} (${s.siteName}) ${s.url}`)
        .join("\n");
      return `Q${i + 1}: ${turn.question}\nA${i + 1} (summary): ${turn.overview}\nSources already cited:\n${cited}`;
    })
    .join("\n\n");
}

export async function POST(request: Request) {
  let question: string;
  let scope: Scope;
  let history: HistoryTurn[];

  try {
    const body = await request.json();
    question = String(body?.question ?? "").trim();
    const raw = String(body?.scope ?? "balanced");
    scope = raw === "academic" || raw === "everything" ? raw : "balanced";
    history = Array.isArray(body?.history) ? (body.history as HistoryTurn[]).slice(-HISTORY_LIMIT) : [];
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: "Enter a question to research." }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ error: "That question is too long — keep it under 500 characters." }, { status: 400 });
  }

  const maxSources = Number(process.env.MAX_SOURCES ?? 8);
  const historyBlock = history.length ? renderHistory(history) : "";

  try {
    // A follow-up like "how did that affect Russia?" is meaningless to a search
    // engine, so resolve it against the conversation before searching.
    let searchQuery = question;
    let wantsMoreSources = false;

    if (history.length > 0 && MORE_SOURCES_RE.test(question)) {
      // Same topic, fresh references. No model call needed to work that out.
      // Reuse the previous turn's RESOLVED query — the raw previous question
      // may itself be context-dependent ("how did it affect Russia?"), and
      // searching that verbatim drifts off the topic entirely.
      wantsMoreSources = true;
      const previous = history[history.length - 1];
      searchQuery = previous.searchQuery?.trim() || previous.question;
    } else if (history.length > 0 && needsRewrite(question)) {
      try {
        const rewrite = await geminiJson<{ searchQuery: string; wantsMoreSources: boolean }>({
          system: FOLLOWUP_SYSTEM,
          schema: FOLLOWUP_SCHEMA,
          prompt: `EARLIER CONVERSATION:\n${historyBlock}\n\nNEW QUESTION: ${question}`,
          maxOutputTokens: 2048,
        });
        if (rewrite.searchQuery?.trim()) searchQuery = rewrite.searchQuery.trim();
        wantsMoreSources = Boolean(rewrite.wantsMoreSources);
      } catch {
        // A failed rewrite shouldn't sink the request — search the raw question.
      }
    }

    // "More sources" means sources we haven't already shown, so ask for a wider
    // net and drop anything already cited in this conversation.
    const seenUrls = new Set(history.flatMap((t) => t.sources.map((s) => s.url)));
    const { results: rawResults, scopeUsed, fellBack } = await searchWithScope(searchQuery, scope, {
      maxResults: wantsMoreSources ? Math.min(maxSources * 2, 20) : maxSources,
    });

    let results: TavilyResult[] = rawResults;
    if (wantsMoreSources) {
      const fresh = rawResults.filter((r) => !seenUrls.has(r.url));
      // Only honour the filter if it leaves enough to work with.
      results = fresh.length >= 3 ? fresh.slice(0, maxSources) : rawResults.slice(0, maxSources);
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: "No sources found for that question. Try rephrasing it or using different keywords." },
        { status: 404 }
      );
    }

    const sourceBlock = results
      .map((r, i) => {
        const dateHint = r.published_date ? `\nSEARCH INDEX DATE HINT: ${r.published_date}` : "";
        return `--- SOURCE ${i + 1} ---
URL: ${r.url}
PAGE TITLE: ${r.title}${dateHint}
CONTENT:
${excerpt(r)}`;
      })
      .join("\n\n");

    const prompt = [
      historyBlock ? `EARLIER CONVERSATION:\n${historyBlock}\n` : "",
      `QUESTION: ${question}`,
      historyBlock && searchQuery !== question ? `(Interpreted for search as: ${searchQuery})` : "",
      `\nToday's date is ${todayISO()}.\n`,
      sourceBlock,
    ]
      .filter(Boolean)
      .join("\n");

    // A request for more sources gets sources — no second essay on a question
    // that was already answered above.
    const model = wantsMoreSources
      ? {
          ...(await geminiJson<{ sources: ModelSource[] }>({
            system: SOURCES_ONLY_SYSTEM,
            schema: SOURCES_ONLY_SCHEMA,
            prompt,
          })),
          overview: "",
          keyPoints: [],
          caveats: [],
          followUps: [],
        }
      : await geminiJson<ModelResponse>({
          system: SYSTEM,
          schema: RESEARCH_SCHEMA,
          prompt,
        });

    const accessedDate = todayISO();

    // Re-anchor the model's output to the real search results. The URL always
    // comes from Tavily, never from the model, so a citation can't point
    // somewhere the model imagined.
    const kept = (model.sources ?? [])
      .filter((s) => s.used !== false)
      .map((s) => ({ s, r: results[s.index - 1] }))
      .filter((pair): pair is { s: ModelSource; r: TavilyResult } => Boolean(pair.r));

    // The model numbers its inline [n] markers by search position. Dropping an
    // unused source shifts everything after it, so markers must be remapped or
    // a claim ends up attributed to the wrong source.
    const numberByModelIndex = new Map<number, number>(kept.map(({ s }, i) => [s.index, i + 1]));

    const sources: Source[] = kept.map(({ s, r }, i) => ({
      number: i + 1,
      url: r.url,
      title: (s.title || r.title).trim(),
      titleSentenceCase: (s.titleSentenceCase || s.title || r.title).trim(),
      authors: Array.isArray(s.authors)
        ? s.authors.filter((a) => a && typeof a.name === "string" && a.name.trim().length > 0)
        : [],
      siteName: (s.siteName || hostname(r.url)).trim(),
      publisher: (s.publisher || s.siteName || hostname(r.url)).trim(),
      publishedDate: s.publishedDate?.trim() || r.published_date?.slice(0, 10) || null,
      accessedDate,
      summary: s.summary?.trim() || "",
      kind: s.kind?.trim() || "Web page",
      reliability: s.reliability ?? "medium",
      reliabilityNote: s.reliabilityNote?.trim() || "",
    }));

    if (sources.length === 0) {
      return NextResponse.json(
        { error: "None of the sources found were relevant enough to cite. Try rephrasing the question." },
        { status: 404 }
      );
    }

    const remap = (text: string) => remapMarkers(text, numberByModelIndex);

    const payload: ResearchResult = {
      question,
      mode: wantsMoreSources ? "sources" : "answer",
      searchQuery,
      scopeUsed,
      scopeFellBack: fellBack,
      overview: remap(model.overview?.trim() || ""),
      keyPoints: (model.keyPoints ?? []).filter(Boolean).map(remap),
      caveats: (model.caveats ?? []).filter(Boolean).map(remap),
      followUps: (model.followUps ?? []).filter(Boolean),
      sources,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof TavilyError || err instanceof GeminiError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
    }
    console.error("[/api/research]", err);
    return NextResponse.json(
      { error: "Something went wrong while researching. Check the server console for details." },
      { status: 500 }
    );
  }
}
