/** Gemini client. Server-side only — the key must never reach the browser. */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Measured against the live free tier, not taken from the docs:
 * `gemini-3.6-flash` returns
 * `GenerateRequestsPerDayPerProjectPerModel-FreeTier, quotaValue: 20`
 * — twenty requests per day, which is roughly ten questions once follow-ups
 * spend two calls each. The quota is per model, so the lite model has its own
 * separate and far larger allowance. Override with GEMINI_MODEL if you have
 * billing enabled and want the stronger model.
 */
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export class GeminiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "GeminiError";
  }
}

/** One entry in the sources array. Shared by both response shapes below. */
const SOURCE_ITEM_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      index: { type: "INTEGER" },
      used: { type: "BOOLEAN" },
      summary: { type: "STRING" },
      kind: { type: "STRING" },
      reliability: { type: "STRING", enum: ["high", "medium", "low"] },
      reliabilityNote: { type: "STRING" },
      title: { type: "STRING" },
      titleSentenceCase: { type: "STRING" },
      authors: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            isOrganization: { type: "BOOLEAN" },
          },
          required: ["name", "isOrganization"],
        },
      },
      siteName: { type: "STRING" },
      publisher: { type: "STRING" },
      publishedDate: { type: "STRING" },
    },
    required: [
      "index", "used", "summary", "kind", "reliability", "reliabilityNote",
      "title", "titleSentenceCase", "authors", "siteName", "publisher", "publishedDate",
    ],
  },
} as const;

/** Shape the model is required to return. Mirrors ResearchResult + SourceMeta. */
export const RESEARCH_SCHEMA = {
  type: "OBJECT",
  properties: {
    overview: { type: "STRING" },
    keyPoints: { type: "ARRAY", items: { type: "STRING" } },
    caveats: { type: "ARRAY", items: { type: "STRING" } },
    followUps: { type: "ARRAY", items: { type: "STRING" } },
    sources: SOURCE_ITEM_SCHEMA,
  },
  required: ["overview", "keyPoints", "caveats", "followUps", "sources"],
} as const;

/**
 * "Can I have more sources?" wants references, not another essay. Omitting the
 * prose fields from the schema is what actually enforces that — the model
 * cannot return an overview it has no field for — and it cuts the output
 * roughly in half, which matters on a 20-request-a-day free tier.
 */
export const SOURCES_ONLY_SCHEMA = {
  type: "OBJECT",
  properties: {
    sources: SOURCE_ITEM_SCHEMA,
  },
  required: ["sources"],
} as const;

/**
 * Turns a context-dependent follow-up into something a search engine can use.
 * "How did it affect Russia?" is meaningless to Tavily on its own.
 */
export const FOLLOWUP_SCHEMA = {
  type: "OBJECT",
  properties: {
    searchQuery: { type: "STRING" },
    wantsMoreSources: { type: "BOOLEAN" },
  },
  required: ["searchQuery", "wantsMoreSources"],
} as const;

export type GeminiJsonOptions = {
  system: string;
  prompt: string;
  schema: unknown;
  signal?: AbortSignal;
  /** Override for small calls like the follow-up rewriter. */
  maxOutputTokens?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Gemini returns 503 ("model overloaded") and 429 (rate limit) as ordinary
 * transients on the free tier — often enough that passing them straight to the
 * user shows a random failure on a request that would succeed a second later.
 * Backoff is longer for 429 since that one is a real quota window.
 */
const RETRY_DELAYS_MS: Record<number, number[]> = {
  503: [800, 2500, 6000],
  500: [800, 2500],
  429: [5000, 15000],
};

export async function geminiJson<T>(opts: GeminiJsonOptions): Promise<T> {
  let lastError: GeminiError | null = null;

  for (let attempt = 0; ; attempt++) {
    try {
      return await attemptGeminiJson<T>(opts);
    } catch (err) {
      if (!(err instanceof GeminiError) || err.status === undefined) throw err;
      const delays = RETRY_DELAYS_MS[err.status];
      if (!delays || attempt >= delays.length) throw err;
      lastError = err;
      if (opts.signal?.aborted) throw err;
      await sleep(delays[attempt]);
    }
  }

  // Unreachable, but keeps the contract explicit if the loop is ever edited.
  throw lastError ?? new GeminiError("Gemini request failed.");
}

async function attemptGeminiJson<T>(opts: GeminiJsonOptions): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set. Add it to .env.local.");
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: opts.schema,
        temperature: 0.3,
        // A full research answer is 8 sources of metadata plus prose, and
        // Gemini 3 spends output tokens on reasoning before it emits any JSON.
        // 8192 truncated real answers mid-object; this leaves clear headroom.
        maxOutputTokens: opts.maxOutputTokens ?? 32768,
      },
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 400 && /API key not valid/i.test(detail)) {
      throw new GeminiError("Gemini rejected the API key. Check GEMINI_API_KEY in .env.local.", 400);
    }
    if (res.status === 429) {
      throw new GeminiError(
        "Gemini free-tier rate limit hit, and retrying didn't clear it. Wait a minute, or set GEMINI_MODEL=gemini-3.5-flash-lite in .env.local for a higher daily quota.",
        429
      );
    }
    if (res.status === 503 || res.status === 500) {
      throw new GeminiError(
        "Gemini is overloaded right now. This is usually brief — press Try again in a few seconds.",
        res.status
      );
    }
    if (res.status === 404) {
      throw new GeminiError(
        `Model "${model}" is not available for this key. Set GEMINI_MODEL in .env.local to a model you have access to.`,
        404
      );
    }
    throw new GeminiError(`Gemini request failed (${res.status}). ${detail.slice(0, 300)}`, res.status);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];

  if (candidate?.finishReason === "SAFETY") {
    throw new GeminiError("Gemini declined to answer this question on safety grounds. Try rephrasing it.");
  }
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new GeminiError(
      "The answer was cut off before it could be parsed. Lower MAX_SOURCES in .env.local, or raise maxOutputTokens in src/lib/gemini.ts."
    );
  }

  const text: string | undefined = candidate?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");

  if (!text) throw new GeminiError("Gemini returned an empty response.");

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError("Gemini returned malformed JSON. Try running the search again.");
  }
}
