/**
 * Deterministic citation formatting.
 *
 * The language model never writes citations — it only extracts metadata
 * (authors, dates, publisher). Every string below is assembled here from that
 * metadata, so switching style is instant and a model hallucination can't
 * invent a reference that doesn't exist.
 */

import type { Author, Source, StyleId } from "./types";

export type Run = { text: string; italic?: boolean };

export type StyleInfo = {
  id: StyleId;
  label: string;
  group: string;
  /** Where a student is most likely to be told to use it. */
  note: string;
};

export const STYLES: StyleInfo[] = [
  { id: "mla9", label: "MLA 9th edition", group: "Humanities", note: "English, literature, most high school essays" },
  { id: "apa7", label: "APA 7th edition", group: "Social sciences", note: "Psychology, education, sociology" },
  { id: "chicago-nb", label: "Chicago — Notes & Bibliography", group: "Humanities", note: "History, art history, footnote style" },
  { id: "chicago-ad", label: "Chicago — Author-Date", group: "Sciences", note: "Chicago for the sciences" },
  { id: "turabian9", label: "Turabian 9th edition", group: "Humanities", note: "Student-facing Chicago" },
  { id: "harvard", label: "Harvard (Cite Them Right)", group: "Social sciences", note: "Common in the UK and Australia" },
  { id: "ieee", label: "IEEE", group: "Engineering", note: "Engineering, computer science" },
  { id: "vancouver", label: "Vancouver", group: "Medicine", note: "Medicine, biomedical research" },
  { id: "ama11", label: "AMA 11th edition", group: "Medicine", note: "Medical and health sciences" },
  { id: "asa6", label: "ASA 6th edition", group: "Social sciences", note: "Sociology" },
  { id: "apsa", label: "APSA", group: "Social sciences", note: "Political science" },
  { id: "cse", label: "CSE (Name-Year)", group: "Sciences", note: "Biology and the life sciences" },
  { id: "bibtex", label: "BibTeX", group: "Export", note: "For LaTeX, Zotero, Overleaf" },
];

export const DEFAULT_STYLE: StyleId = "mla9";

export function styleInfo(id: StyleId): StyleInfo {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}

/** Styles whose reference list is numbered in citation order rather than alphabetised. */
const NUMERIC_STYLES = new Set<StyleId>(["ieee", "vancouver", "ama11"]);

export function isNumericStyle(id: StyleId): boolean {
  return NUMERIC_STYLES.has(id);
}

/** What the reference list is called in each style. */
export function bibliographyHeading(id: StyleId): string {
  switch (id) {
    case "mla9":
      return "Works Cited";
    case "apa7":
    case "harvard":
    case "chicago-ad":
    case "asa6":
    case "apsa":
    case "cse":
      return "References";
    case "chicago-nb":
    case "turabian9":
      return "Bibliography";
    case "ieee":
    case "vancouver":
    case "ama11":
      return "References";
    case "bibtex":
      return "BibTeX";
  }
}

/* ------------------------------------------------------------------ */
/* Run helpers                                                         */
/* ------------------------------------------------------------------ */

const T = (text: string): Run => ({ text });
const I = (text: string): Run => ({ text, italic: true });

type Part = Run | Run[] | string | null | undefined | false;

function build(parts: Part[]): Run[] {
  const flat: Run[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (typeof p === "string") flat.push({ text: p });
    else if (Array.isArray(p)) flat.push(...p);
    else flat.push(p);
  }

  const out: Run[] = [];
  for (const r of flat) {
    let text = r.text.replace(/\s+/g, " ");
    if (!text) continue;
    const prev = out[out.length - 1];
    if (prev) {
      // Don't let a run start with a space/period that the previous run already ended with.
      if (/\s$/.test(prev.text) && /^\s/.test(text)) text = text.replace(/^\s+/, "");
      if (/[.]$/.test(prev.text) && /^\./.test(text)) text = text.replace(/^\.+/, "");
      if (/[?!]$/.test(prev.text) && /^\./.test(text)) text = text.replace(/^\.+/, "");
    }
    if (!text) continue;
    if (prev && !!prev.italic === !!r.italic) prev.text += text;
    else out.push({ text, italic: r.italic });
  }

  if (out.length) out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, "");
  if (out.length) out[0].text = out[0].text.replace(/^\s+/, "");
  return out.filter((r) => r.text.length > 0);
}

export function runsToText(runs: Run[]): string {
  return runs.map((r) => r.text).join("");
}

/** Markdown rendering, for the "copy as Markdown" path. */
export function runsToMarkdown(runs: Run[]): string {
  return runs.map((r) => (r.italic ? `*${r.text}*` : r.text)).join("");
}

/** Add a terminal period unless the text already ends in sentence punctuation. */
function period(s: string): string {
  return /[.?!]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`;
}

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */

type PersonName = { last: string; given: string[]; suffix: string };

const SUFFIX_RE = /^(Jr\.?|Sr\.?|II|III|IV|V)$/i;
const PARTICLE_RE = /^(van|von|de|del|della|di|da|dos|du|la|le|den|der|ter|bin|al|st\.?)$/i;

function splitName(raw: string): PersonName {
  const cleaned = raw.replace(/\s+/g, " ").trim();

  if (cleaned.includes(",")) {
    const [lastPart, ...restParts] = cleaned.split(",");
    const rest = restParts.join(",").trim();
    const given = rest.split(" ").filter(Boolean);
    let suffix = "";
    if (given.length && SUFFIX_RE.test(given[given.length - 1])) suffix = given.pop()!;
    // "Martin Luther King, Jr." is a full name plus a suffix, not "Last, First".
    // Only the suffix followed the comma, so re-read the front half as a whole name.
    if (given.length === 0 && suffix && lastPart.trim().includes(" ")) {
      const inner = splitName(lastPart);
      return { ...inner, suffix };
    }
    return { last: lastPart.trim(), given, suffix };
  }

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 0) return { last: cleaned, given: [], suffix: "" };
  if (parts.length === 1) return { last: parts[0], given: [], suffix: "" };

  let suffix = "";
  if (SUFFIX_RE.test(parts[parts.length - 1])) suffix = parts.pop()!;

  let i = parts.length - 1;
  while (i > 1 && PARTICLE_RE.test(parts[i - 1])) i--;

  return { last: parts.slice(i).join(" "), given: parts.slice(0, i), suffix };
}

function initials(given: string[], opts: { periods: boolean; spaced: boolean }): string {
  const letters = given
    .filter(Boolean)
    .map((g) => g.replace(/[^A-Za-zÀ-ɏ]/g, "").charAt(0).toUpperCase())
    .filter(Boolean);
  if (!letters.length) return "";
  const each = letters.map((l) => (opts.periods ? `${l}.` : l));
  return each.join(opts.spaced ? " " : "");
}

/** "Jane Q. Smith" */
function full(n: PersonName): string {
  return [n.given.join(" "), n.last, n.suffix].filter(Boolean).join(" ").trim();
}

/** "Smith, Jane Q." */
function inverted(n: PersonName): string {
  const given = n.given.join(" ");
  const base = given ? `${n.last}, ${given}` : n.last;
  return n.suffix ? `${base}, ${n.suffix}` : base;
}

/** "Smith, J. Q." */
function invertedInitials(n: PersonName, opts: { periods: boolean; spaced: boolean }): string {
  const ini = initials(n.given, opts);
  const base = ini ? `${n.last}, ${ini}` : n.last;
  return n.suffix ? `${base}, ${n.suffix}` : base;
}

/** "Smith JQ" — Vancouver/AMA/CSE. */
function lastThenInitials(n: PersonName): string {
  const ini = initials(n.given, { periods: false, spaced: false });
  const base = ini ? `${n.last} ${ini}` : n.last;
  return n.suffix ? `${base} ${n.suffix}` : base;
}

/** "J. Q. Smith" — IEEE. */
function initialsThenLast(n: PersonName): string {
  const ini = initials(n.given, { periods: true, spaced: true });
  return [ini, n.last, n.suffix].filter(Boolean).join(" ");
}

type NameRenderer = (n: PersonName, index: number) => string;

/**
 * Render an author list. Organisations pass straight through unchanged;
 * only personal names get reordered or initialised.
 */
function authorList(
  authors: Author[],
  render: NameRenderer,
  join: (names: string[]) => string
): string {
  const names = authors.map((a, i) => (a.isOrganization ? a.name.trim() : render(splitName(a.name), i)));
  return join(names.filter(Boolean));
}

/**
 * Chicago-family joining: a comma always precedes the conjunction, including
 * in the two-name case ("Smith, John, and Jane Doe").
 */
function chicagoJoin(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** "a, b, and c" with a configurable conjunction and Oxford comma. */
function seriesJoin(names: string[], conj: string, oxford = true): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} ${conj} ${names[1]}`;
  const head = names.slice(0, -1).join(", ");
  return `${head}${oxford ? "," : ""} ${conj} ${names[names.length - 1]}`;
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

type DateParts = { y: number; m: number | null; d: number | null };

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
/** MLA 9 abbreviates everything except May, June, July. */
const MONTHS_MLA = [
  "Jan.", "Feb.", "Mar.", "Apr.", "May", "June",
  "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec.",
];
const MONTHS_IEEE = [
  "Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.",
  "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec.",
];
/** Vancouver / AMA / CSE — three letters, no period. */
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseDate(value: string | null | undefined): DateParts | null {
  if (!value) return null;
  const m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  if (!Number.isFinite(y) || y < 1000 || y > 2200) return null;
  const mo = m[2] ? Number(m[2]) : null;
  const d = m[3] ? Number(m[3]) : null;
  return {
    y,
    m: mo && mo >= 1 && mo <= 12 ? mo : null,
    d: d && d >= 1 && d <= 31 ? d : null,
  };
}

/** "14 May 2023" — MLA, Harvard, IEEE accessed-dates. */
function dmy(p: DateParts, months: string[]): string {
  const mo = p.m ? months[p.m - 1] : null;
  return [p.d ?? null, mo, p.y].filter((x) => x !== null && x !== undefined).join(" ");
}

/** "May 14, 2023" — Chicago, AMA, ASA. */
function mdy(p: DateParts, months: string[]): string {
  if (!p.m) return String(p.y);
  const mo = months[p.m - 1];
  return p.d ? `${mo} ${p.d}, ${p.y}` : `${mo} ${p.y}`;
}

/** "May 14" — Chicago author-date, where the year already sits up front. */
function md(p: DateParts, months: string[]): string {
  if (!p.m) return "";
  const mo = months[p.m - 1];
  return p.d ? `${mo} ${p.d}` : mo;
}

/** "2023 May 14" — Vancouver, CSE. */
function ymd(p: DateParts): string {
  if (!p.m) return String(p.y);
  const mo = MONTHS_SHORT[p.m - 1];
  return p.d ? `${p.y} ${mo} ${p.d}` : `${p.y} ${mo}`;
}

/** "2023, May 14" — APA. */
function apaDate(p: DateParts | null): string {
  if (!p) return "n.d.";
  if (!p.m) return String(p.y);
  const mo = MONTHS_FULL[p.m - 1];
  return p.d ? `${p.y}, ${mo} ${p.d}` : `${p.y}, ${mo}`;
}

function year(p: DateParts | null, fallback = "n.d."): string {
  return p ? String(p.y) : fallback;
}

/* ------------------------------------------------------------------ */
/* Reference list entries                                              */
/* ------------------------------------------------------------------ */

/**
 * Build the bibliography entry for one source in the requested style.
 * BibTeX is handled separately by `bibtexEntry`.
 */
export function formatCitation(source: Source, style: StyleId): Run[] {
  const pub = parseDate(source.publishedDate);
  const acc = parseDate(source.accessedDate);
  const hasAuthor = source.authors.length > 0;
  const site = source.siteName.trim();
  const publisher = source.publisher.trim();
  // Chicago and MLA drop the publisher when it just repeats the site name.
  const distinctPublisher =
    publisher && publisher.toLowerCase() !== site.toLowerCase() ? publisher : "";

  switch (style) {
    /* ---------------------------------------------------------- MLA 9 */
    case "mla9": {
      const authors = authorList(
        source.authors,
        (n, i) => (i === 0 ? inverted(n) : full(n)),
        (names) => {
          if (names.length === 0) return "";
          if (names.length === 1) return names[0];
          if (names.length === 2) return `${names[0]}, and ${names[1]}`;
          return `${names[0]}, et al`;
        }
      );
      return build([
        authors && T(`${period(authors)} `),
        T(`“${period(source.title)}” `),
        site && I(site),
        site && T(", "),
        distinctPublisher && T(`${distinctPublisher}, `),
        pub && T(`${dmy(pub, MONTHS_MLA)}, `),
        T(`${source.url}. `),
        acc && T(`Accessed ${dmy(acc, MONTHS_MLA)}.`),
      ]);
    }

    /* ---------------------------------------------------------- APA 7 */
    case "apa7": {
      const authors = authorList(
        source.authors,
        (n) => invertedInitials(n, { periods: true, spaced: true }),
        (names) => {
          if (names.length === 0) return "";
          if (names.length === 1) return names[0];
          if (names.length === 2) return `${names[0]}, & ${names[1]}`;
          if (names.length <= 20) {
            return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
          }
          return `${names.slice(0, 19).join(", ")}, ... ${names[names.length - 1]}`;
        }
      );
      // APA omits the site name when the author is the site.
      const showSite =
        site && !(hasAuthor && source.authors[0].name.toLowerCase() === site.toLowerCase());
      return build([
        // With no author the title moves to the front, and stays italic.
        authors ? T(`${period(authors)} `) : [I(period(source.titleSentenceCase)), T(" ")],
        T(`(${apaDate(pub)}). `),
        authors ? I(source.titleSentenceCase) : null,
        authors ? T(". ") : null,
        showSite && T(`${period(site)} `),
        T(source.url),
        !pub && acc ? T(` (Retrieved ${mdy(acc, MONTHS_FULL)})`) : null,
      ]);
    }

    /* ------------------------------------------ Chicago / Turabian NB */
    case "chicago-nb":
    case "turabian9": {
      const authors = chicagoAuthors(source.authors);
      return build([
        authors && T(`${period(authors)} `),
        T(`“${period(source.title)}” `),
        site && I(site),
        site && T(". "),
        distinctPublisher && T(`${period(distinctPublisher)} `),
        pub ? T(`${period(mdy(pub, MONTHS_FULL))} `) : acc ? T(`Accessed ${period(mdy(acc, MONTHS_FULL))} `) : null,
        T(period(source.url)),
      ]);
    }

    /* ---------------------------------------------- Chicago Author-Date */
    case "chicago-ad": {
      const authors = chicagoAuthors(source.authors);
      const y = period(year(pub));
      return build([
        // No author means the title leads and the date follows it.
        authors ? T(`${period(authors)} ${y} `) : null,
        T(`“${period(source.title)}” `),
        !authors ? T(`${y} `) : null,
        site && I(site),
        site && T(". "),
        pub && pub.m ? T(`${md(pub, MONTHS_FULL)}. `) : null,
        acc && T(`Accessed ${mdy(acc, MONTHS_FULL)}. `),
        T(period(source.url)),
      ]);
    }

    /* -------------------------------------------------------- Harvard */
    case "harvard": {
      const authors = authorList(
        source.authors,
        (n) => invertedInitials(n, { periods: true, spaced: false }),
        (names) => {
          if (names.length === 0) return "";
          if (names.length === 1) return names[0];
          if (names.length === 2) return `${names[0]} and ${names[1]}`;
          if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
          return `${names[0]} et al.`;
        }
      );
      const lead = authors || site || source.title;
      return build([
        T(`${lead} `),
        T(`(${year(pub, "no date")}) `),
        I(source.titleSentenceCase),
        T(". "),
        T(`Available at: ${source.url} `),
        acc && T(`(Accessed: ${dmy(acc, MONTHS_FULL)}).`),
      ]);
    }

    /* ----------------------------------------------------------- IEEE */
    case "ieee": {
      const authors = authorList(
        source.authors,
        (n) => initialsThenLast(n),
        (names) => {
          if (names.length === 0) return "";
          if (names.length === 1) return names[0];
          if (names.length <= 6) return seriesJoin(names, "and", true);
          return `${names[0]} et al.`;
        }
      );
      return build([
        authors && T(`${authors.replace(/\.$/, "")}, `),
        T(`“${source.title.replace(/[.]$/, "")},” `),
        site && I(site),
        site && T(pub ? ", " : ". "),
        pub && T(`${mdy(pub, MONTHS_IEEE)}. `),
        T("[Online]. Available: "),
        T(`${source.url}. `),
        acc && T(`[Accessed: ${dmy(acc, MONTHS_IEEE).replace(/ /g, "-")}].`),
      ]);
    }

    /* ------------------------------------------------------ Vancouver */
    case "vancouver": {
      const authors = authorList(
        source.authors,
        (n) => lastThenInitials(n),
        (names) => (names.length <= 6 ? names.join(", ") : `${names.slice(0, 6).join(", ")}, et al`)
      );
      return build([
        authors && T(`${period(authors)} `),
        T(`${source.titleSentenceCase.replace(/[.]$/, "")} [Internet]. `),
        site && T(`${period(site)} `),
        pub && T(`${ymd(pub)} `),
        acc && T(`[cited ${ymd(acc)}]. `),
        T(`Available from: ${source.url}`),
      ]);
    }

    /* ---------------------------------------------------------- AMA 11 */
    case "ama11": {
      const authors = authorList(
        source.authors,
        (n) => lastThenInitials(n),
        (names) => (names.length <= 6 ? names.join(", ") : `${names.slice(0, 3).join(", ")}, et al`)
      );
      return build([
        authors && T(`${period(authors)} `),
        T(`${period(source.titleSentenceCase)} `),
        site && I(site),
        site && T(". "),
        pub && T(`Published ${mdy(pub, MONTHS_FULL)}. `),
        acc && T(`Accessed ${mdy(acc, MONTHS_FULL)}. `),
        T(source.url),
      ]);
    }

    /* ---------------------------------------------------------- ASA 6 */
    case "asa6": {
      const authors = authorList(
        source.authors,
        (n, i) => (i === 0 ? inverted(n) : full(n)),
        (names) => {
          if (names.length === 0) return "";
          if (names.length <= 3) return chicagoJoin(names);
          return `${names[0]} et al.`;
        }
      );
      const y = period(year(pub, "N.d."));
      return build([
        authors ? T(`${period(authors)} ${y} `) : null,
        T(`“${period(source.title)}” `),
        !authors ? T(`${y} `) : null,
        site && I(site),
        site && T(". "),
        acc && T(`Retrieved ${mdy(acc, MONTHS_FULL)} `),
        T(`(${source.url}).`),
      ]);
    }

    /* ----------------------------------------------------------- APSA */
    case "apsa": {
      const authors = authorList(
        source.authors,
        (n, i) => (i === 0 ? inverted(n) : full(n)),
        (names) => chicagoJoin(names)
      );
      const y = period(year(pub));
      return build([
        authors ? T(`${period(authors)} ${y} `) : null,
        T(`“${period(source.title)}” `),
        !authors ? T(`${y} `) : null,
        site && I(site),
        site && T(". "),
        T(`${source.url} `),
        acc && T(`(accessed ${mdy(acc, MONTHS_FULL)}).`),
      ]);
    }

    /* ---------------------------------------------------- CSE Name-Year */
    case "cse": {
      const authors = authorList(
        source.authors,
        (n) => lastThenInitials(n),
        (names) => (names.length <= 10 ? names.join(", ") : `${names.slice(0, 10).join(", ")}, et al`)
      );
      const y = period(year(pub));
      return build([
        authors ? T(`${period(authors)} ${y} `) : null,
        T(`${period(source.titleSentenceCase)} `),
        !authors ? T(`${y} `) : null,
        site && T(`${site}; `),
        acc && T(`[accessed ${ymd(acc)}]. `),
        T(source.url),
      ]);
    }

    case "bibtex":
      return build([T(bibtexEntry(source))]);
  }
}

/** Chicago/Turabian author ordering — first inverted, the rest natural. */
function chicagoAuthors(authors: Author[]): string {
  return authorList(
    authors,
    (n, i) => (i === 0 ? inverted(n) : full(n)),
    (names) => (names.length <= 10 ? chicagoJoin(names) : `${names.slice(0, 7).join(", ")}, et al.`)
  );
}

/* ------------------------------------------------------------------ */
/* In-text citations                                                   */
/* ------------------------------------------------------------------ */

/** The parenthetical / bracketed marker a student drops into their sentence. */
export function inTextCitation(source: Source, style: StyleId): string {
  const pub = parseDate(source.publishedDate);
  const y = year(pub);

  const surname = (): string => {
    if (!source.authors.length) return `“${shortTitle(source.title)}”`;
    const a = source.authors[0];
    if (a.isOrganization) return a.name;
    const n = splitName(a.name);
    if (source.authors.length === 1) return n.last;
    if (source.authors.length === 2) {
      const b = source.authors[1];
      const bl = b.isOrganization ? b.name : splitName(b.name).last;
      return `${n.last} and ${bl}`;
    }
    return `${n.last} et al.`;
  };

  switch (style) {
    case "mla9":
      return `(${surname()})`;
    case "apa7":
      return `(${surname().replace(" and ", " & ")}, ${y})`;
    case "harvard":
      return `(${surname()}, ${y})`;
    case "chicago-ad":
    case "asa6":
      return `(${surname()} ${y})`;
    case "apsa":
      return `(${surname()} ${y})`;
    case "cse":
      return `(${surname()} ${y})`;
    case "chicago-nb":
    case "turabian9":
      return `${source.number}.`; // footnote marker
    case "ieee":
      return `[${source.number}]`;
    case "vancouver":
    case "ama11":
      return `(${source.number})`;
    case "bibtex":
      return `\\cite{${bibtexKey(source)}}`;
  }
}

function shortTitle(title: string): string {
  const words = title.split(/\s+/);
  return words.length <= 4 ? title : `${words.slice(0, 4).join(" ")}...`;
}

/* ------------------------------------------------------------------ */
/* BibTeX                                                              */
/* ------------------------------------------------------------------ */

function bibtexKey(source: Source): string {
  const pub = parseDate(source.publishedDate);
  const who = source.authors.length
    ? (source.authors[0].isOrganization
        ? source.authors[0].name
        : splitName(source.authors[0].name).last)
    : source.siteName || "web";
  const slug = who.toLowerCase().replace(/[^a-z0-9]/g, "");
  const firstWord = source.title.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${slug || "src"}${pub ? pub.y : "nd"}${firstWord}`;
}

export function bibtexEntry(source: Source): string {
  const pub = parseDate(source.publishedDate);
  const acc = parseDate(source.accessedDate);
  const authors = source.authors
    .map((a) => (a.isOrganization ? `{${a.name}}` : inverted(splitName(a.name))))
    .join(" and ");

  const fields: Array<[string, string]> = [];
  if (authors) fields.push(["author", authors]);
  fields.push(["title", source.title]);
  if (source.siteName) fields.push(["howpublished", `\\url{${source.url}}`]);
  if (source.publisher) fields.push(["publisher", source.publisher]);
  if (pub) fields.push(["year", String(pub.y)]);
  if (pub?.m) fields.push(["month", MONTHS_SHORT[pub.m - 1].toLowerCase()]);
  fields.push(["url", source.url]);
  if (acc) fields.push(["urldate", `${acc.y}-${String(acc.m ?? 1).padStart(2, "0")}-${String(acc.d ?? 1).padStart(2, "0")}`]);
  if (acc) fields.push(["note", `Accessed: ${dmy(acc, MONTHS_FULL)}`]);

  const body = fields.map(([k, v]) => `  ${k.padEnd(12)} = {${v}}`).join(",\n");
  return `@misc{${bibtexKey(source)},\n${body}\n}`;
}

/* ------------------------------------------------------------------ */
/* Reference list ordering                                             */
/* ------------------------------------------------------------------ */

/** Alphabetical for author-date styles, citation order for numeric ones. */
export function orderSources(sources: Source[], style: StyleId): Source[] {
  if (isNumericStyle(style) || style === "bibtex") {
    return [...sources].sort((a, b) => a.number - b.number);
  }
  return [...sources].sort((a, b) => {
    const key = (s: Source) => {
      if (!s.authors.length) return s.title.toLowerCase();
      const a0 = s.authors[0];
      return (a0.isOrganization ? a0.name : splitName(a0.name).last).toLowerCase();
    };
    return key(a).localeCompare(key(b)) || a.number - b.number;
  });
}

/** The whole reference list as plain text, ready for the clipboard. */
export function bibliographyText(sources: Source[], style: StyleId): string {
  const ordered = orderSources(sources, style);
  if (style === "bibtex") return ordered.map((s) => bibtexEntry(s)).join("\n\n");
  const numbered = isNumericStyle(style);
  return ordered
    .map((s, i) => {
      const line = runsToText(formatCitation(s, style));
      return numbered ? `[${i + 1}] ${line}` : line;
    })
    .join("\n\n");
}
