/** Tavily search client. Server-side only — the key must never reach the browser. */

export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string | null;
  published_date?: string | null;
};

type TavilyResponse = {
  query: string;
  results: TavilyResult[];
  response_time: number;
};

export class TavilyError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "TavilyError";
  }
}

/**
 * Universities and government bodies, as TLD wildcards.
 *
 * Deliberately short. Measured against the live API, `include_domains` is
 * unreliable once the list grows: the same five-wildcard list returned zero
 * results on three consecutive calls and eight on the next probe, and a
 * four-item list returned zero while a five-item superset of it returned
 * eight. Bare suffixes like ".edu" are accepted but silently do not filter at
 * all — only the "*.edu" form works. Every academic search therefore runs
 * through `searchWithScope`, which falls back rather than trusting this.
 */
export const ACADEMIC_INCLUDE = ["*.edu", "*.gov", "*.ac.uk"];

/**
 * Video, social, and homework-mill sites. Not "bad websites" in general —
 * just places a student should not be citing in an essay.
 */
export const LOW_SIGNAL_DOMAINS = [
  "youtube.com", "m.youtube.com", "youtu.be", "tiktok.com", "facebook.com",
  "instagram.com", "x.com", "twitter.com", "reddit.com", "quora.com",
  "pinterest.com", "tumblr.com", "linkedin.com", "slideshare.net", "prezi.com",
  "scribd.com", "coursehero.com", "studocu.com", "chegg.com", "numerade.com",
  "brainly.com", "brainly.in", "brainly.ph", "quizlet.com", "coursesidekick.com",
  "study.com", "bartleby.com", "sparknotes.com", "cliffsnotes.com", "gradesaver.com",
  "enotes.com", "123helpme.com", "ukessays.com", "studymode.com", "ipl.org",
  "answers.com", "ask.com", "wikihow.com", "buzzfeed.com", "vaia.com",
  "studysmarter.co.uk", "toppr.com", "byjus.com", "vedantu.com", "unacademy.com",
  // Essay mills. These surfaced in real balanced-scope results and are the last
  // thing a student should be citing.
  "edubirdie.com", "hub.edubirdie.com", "papersowl.com", "gradesfixer.com",
  "ivypanda.com", "studycorgi.com", "nerdyseal.com", "phdessay.com",
  "studymoose.com", "paperap.com", "essaypro.com", "customwritings.com",
  "myperfectwords.com", "freeessaywriter.net", "essaysauce.com", "ukdiss.com",
];

export async function tavilySearch(
  query: string,
  opts: {
    maxResults?: number;
    signal?: AbortSignal;
    includeDomains?: string[];
    excludeDomains?: string[];
  } = {}
): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new TavilyError("TAVILY_API_KEY is not set. Add it to .env.local.");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      max_results: opts.maxResults ?? 8,
      include_raw_content: "markdown",
      include_answer: false,
      include_images: false,
      ...(opts.includeDomains?.length ? { include_domains: opts.includeDomains } : {}),
      ...(opts.excludeDomains?.length ? { exclude_domains: opts.excludeDomains } : {}),
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new TavilyError("Tavily rejected the API key. Check TAVILY_API_KEY in .env.local.", res.status);
    }
    if (res.status === 429) {
      throw new TavilyError("Tavily rate limit or monthly credit reached. Try again later.", res.status);
    }
    throw new TavilyError(`Tavily search failed (${res.status}). ${detail.slice(0, 200)}`, res.status);
  }

  const data = (await res.json()) as TavilyResponse;
  return (data.results ?? []).filter((r) => r.url && r.title);
}

export type Scope = "balanced" | "academic" | "everything";

export type ScopedSearch = {
  results: TavilyResult[];
  /** The scope actually used, which may differ from the one requested. */
  scopeUsed: Scope;
  /** True when an academic search came back too thin and we widened it. */
  fellBack: boolean;
};

/** Below this many results, an academic search isn't worth the narrowness. */
const MIN_ACADEMIC_RESULTS = 4;

/**
 * Run the search for a scope, guaranteeing the caller gets usable results.
 *
 * Academic mode is best-effort by necessity: the domain filter returns an
 * empty set often enough that a student would otherwise hit "no sources
 * found" at random. When that happens we rerun without the include filter
 * and report the fallback rather than silently pretending it worked.
 */
export async function searchWithScope(
  query: string,
  scope: Scope,
  opts: { maxResults?: number; signal?: AbortSignal } = {}
): Promise<ScopedSearch> {
  const base = { maxResults: opts.maxResults, signal: opts.signal };

  if (scope === "everything") {
    return { results: await tavilySearch(query, base), scopeUsed: "everything", fellBack: false };
  }

  if (scope === "academic") {
    const strict = await tavilySearch(query, {
      ...base,
      includeDomains: ACADEMIC_INCLUDE,
      excludeDomains: LOW_SIGNAL_DOMAINS,
    });
    if (strict.length >= MIN_ACADEMIC_RESULTS) {
      return { results: strict, scopeUsed: "academic", fellBack: false };
    }
    const widened = await tavilySearch(query, { ...base, excludeDomains: LOW_SIGNAL_DOMAINS });
    // Keep whichever is actually better rather than assuming the retry won.
    if (widened.length <= strict.length) {
      return { results: strict, scopeUsed: "academic", fellBack: false };
    }
    return { results: widened, scopeUsed: "balanced", fellBack: true };
  }

  return {
    results: await tavilySearch(query, { ...base, excludeDomains: LOW_SIGNAL_DOMAINS }),
    scopeUsed: "balanced",
    fellBack: false,
  };
}

/**
 * Trim page text before it goes to the model. Free-tier token budgets are
 * finite, and the first few thousand characters carry the substance.
 */
export function excerpt(result: TavilyResult, limit = 4000): string {
  const body = (result.raw_content || result.content || "").replace(/\s+/g, " ").trim();
  return body.length > limit ? `${body.slice(0, limit)}…` : body;
}
