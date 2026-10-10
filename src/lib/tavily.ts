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
 * Where the "Academic" scope searches: scholarly publishers, research
 * universities, government and intergovernmental bodies, and research
 * organisations. A plain domain covers its subdomains (nih.gov includes
 * pmc.ncbi.nlm.nih.gov, harvard.edu includes med.harvard.edu).
 *
 * Concrete domains, not suffixes. Tavily now rejects TLD wildcards such as
 * "*.edu" with a 400, and a bare ".edu" returns nothing — which broke every
 * academic search. Measured in October 2026: this 60-domain list returned 15–16
 * results for history, science, economics and literature questions alike, and
 * the same results on repeat calls. searchWithScope still falls back if it
 * comes back thin or fails.
 */
export const ACADEMIC_INCLUDE = [
  // Journals, presses and scholarly databases
  "jstor.org", "muse.jhu.edu", "sciencedirect.com", "springer.com", "wiley.com",
  "tandfonline.com", "cambridge.org", "academic.oup.com", "sagepub.com", "arxiv.org",
  "plos.org", "pnas.org", "nature.com", "science.org", "cell.com", "thelancet.com",
  "bmj.com", "nejm.org", "jamanetwork.com", "pubs.acs.org", "ieee.org", "acm.org",
  "frontiersin.org", "annualreviews.org", "nber.org", "britannica.com",
  // Government and intergovernmental
  "nih.gov", "cdc.gov", "state.gov", "loc.gov", "archives.gov", "nasa.gov", "noaa.gov",
  "energy.gov", "census.gov", "bls.gov", "federalreserve.gov", "si.edu", "gov.uk",
  "europa.eu", "who.int", "un.org", "worldbank.org", "imf.org", "oecd.org",
  // Research organisations
  "pewresearch.org", "brookings.edu", "rand.org", "cfr.org",
  // Universities
  "harvard.edu", "stanford.edu", "mit.edu", "yale.edu", "princeton.edu", "berkeley.edu",
  "columbia.edu", "uchicago.edu", "ox.ac.uk", "cam.ac.uk", "ucl.ac.uk",
];

/** True for academic and official hosts, used to rank a widened search. */
export function isAcademicHost(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (/\.(edu|gov|mil|int)$|\.(ac|edu|gov)\.[a-z]{2}$|\.gc\.ca$/.test(host)) return true;
  return ACADEMIC_INCLUDE.some((d) => host === d || host.endsWith(`.${d}`));
}

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
  if (!key) {
    console.error("[tavily] TAVILY_API_KEY is not set");
    throw new TavilyError("Search isn't set up on the server yet. Try again later.", 503);
  }

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

  // These messages are shown to students, so they say what to do; the
  // technical detail goes to the server log instead.
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[tavily] ${res.status}`, detail.slice(0, 500));
    if (res.status === 429 || res.status === 432 || res.status === 433) {
      throw new TavilyError("The search service is busy right now. Try again in a few minutes.", 503);
    }
    throw new TavilyError("The search service had a problem with that request. Try again in a moment.", 502);
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
    let strict: TavilyResult[] = [];
    try {
      strict = await tavilySearch(query, {
        ...base,
        includeDomains: ACADEMIC_INCLUDE,
        excludeDomains: LOW_SIGNAL_DOMAINS,
      });
    } catch (err) {
      // A rejected filter (as when Tavily stopped accepting "*.edu") must not
      // sink the search; widen instead, below.
      if (!(err instanceof TavilyError)) throw err;
    }
    if (strict.length >= MIN_ACADEMIC_RESULTS) {
      return { results: strict, scopeUsed: "academic", fellBack: false };
    }
    const widenedRaw = await tavilySearch(query, { ...base, excludeDomains: LOW_SIGNAL_DOMAINS });
    // Academic and official pages first, so the closest thing to what was
    // asked for is what gets read.
    const widened = [
      ...widenedRaw.filter((r) => isAcademicHost(r.url)),
      ...widenedRaw.filter((r) => !isAcademicHost(r.url)),
    ];
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
