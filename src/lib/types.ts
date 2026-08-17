export type Author = {
  name: string;
  /** True for corporate/organisational authors ("NASA", "World Health Organization"). */
  isOrganization: boolean;
};

export type SourceMeta = {
  url: string;
  title: string;
  /** Same title in sentence case, for APA/Harvard/Vancouver-family styles. */
  titleSentenceCase: string;
  authors: Author[];
  /** The website/container the piece sits in — "Britannica", "Nature", "BBC News". */
  siteName: string;
  /** The organisation responsible for the site. Often the same as siteName. */
  publisher: string;
  /** "2023-05-14" | "2023-05" | "2023" | null when undated. */
  publishedDate: string | null;
  /** ISO date the app retrieved the page. */
  accessedDate: string;
};

export type Source = SourceMeta & {
  /** 1-based position in the reference list. */
  number: number;
  /** What this specific source contributes to the answer. */
  summary: string;
  /** Short tag: "Encyclopedia", "Peer-reviewed", "News", "Government", ... */
  kind: string;
  /** Rough credibility read, surfaced to the student as a nudge not a verdict. */
  reliability: "high" | "medium" | "low";
  reliabilityNote: string;
};

export type Scope = "balanced" | "academic" | "everything";

/**
 * "answer" is a full response — prose, key points, caveats, sources.
 * "sources" is a references-only turn, produced when the student asked for
 * more sources rather than for something new to be explained.
 */
export type ResultMode = "answer" | "sources";

export type ResearchResult = {
  question: string;
  mode: ResultMode;
  /**
   * The self-contained query this turn was actually searched with. Differs
   * from `question` for follow-ups, and later turns reuse it so a request
   * like "more sources" doesn't re-search a context-dependent string.
   */
  searchQuery: string;
  /** The scope actually searched, which may differ from the one requested. */
  scopeUsed: Scope;
  /** True when academic mode found too little and the search was widened. */
  scopeFellBack: boolean;
  /** 2–3 paragraph prose answer. */
  overview: string;
  keyPoints: string[];
  sources: Source[];
  /** Disagreements, gaps, or bias worth flagging to a student. */
  caveats: string[];
  followUps: string[];
  generatedAt: string;
};

export type TurnStatus = "loading" | "done" | "error";

/** One question and its answer inside a conversation. */
export type Turn = {
  id: string;
  question: string;
  status: TurnStatus;
  result: ResearchResult | null;
  error: string | null;
  createdAt: string;
};

export type TabKind = "personal" | "group";

export type Tab = {
  id: string;
  title: string;
  kind: TabKind;
  style: StyleId;
  scope: Scope;
  turns: Turn[];
  createdAt: string;
  /** Public id once shared. Group tabs get one; personal tabs stay null. */
  shareId: string | null;
  /** True while this tab is being pushed to or pulled from the server. */
  syncing?: boolean;
  /** Set when a share operation failed, so the UI can explain why. */
  shareError?: string | null;
  /**
   * How many turns this browser had seen last time the tab was opened. Drives
   * the "3 in" badge counting follow-ups other people added through the link.
   */
  seenTurns?: number;
};

/** The subset of a tab that lives on the server for group sharing. */
export type SharedConversation = {
  shareId: string;
  title: string;
  style: StyleId;
  scope: Scope;
  turns: Turn[];
  updatedAt: string;
};

/** Compact prior context sent to the model so follow-ups make sense. */
export type HistoryTurn = {
  question: string;
  /** What this turn was actually searched as, once pronouns were resolved. */
  searchQuery: string;
  overview: string;
  sources: Array<{ number: number; title: string; url: string; siteName: string }>;
};

export type StyleId =
  | "mla9"
  | "apa7"
  | "chicago-nb"
  | "chicago-ad"
  | "turabian9"
  | "harvard"
  | "ieee"
  | "vancouver"
  | "ama11"
  | "asa6"
  | "apsa"
  | "cse"
  | "bibtex";
