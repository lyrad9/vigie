// Content negotiation between HTML and Markdown, following acceptmarkdown.com:
// rank by q-value, break ties by specificity (type/subtype > type/* > */*), never pick q=0,
// default to HTML when there is no Accept header, on */* and on ties, and answer 406 only
// when neither representation is acceptable.

export type Representation = "text/html" | "text/markdown";
export const REPRESENTATIONS: Representation[] = ["text/html", "text/markdown"];
const DEFAULT: Representation = "text/html";

type Range = { type: string; subtype: string; q: number };

export function parseAccept(header: string): Range[] {
  const ranges: Range[] = [];
  for (const part of header.split(",")) {
    const [media, ...params] = part.split(";").map((s) => s.trim());
    if (!media) continue;
    const [type, subtype] = media.toLowerCase().split("/");
    if (!type || !subtype) continue;
    let q = 1;
    for (const param of params) {
      const [key, value] = param.split("=").map((s) => s.trim());
      if (key?.toLowerCase() === "q") {
        const parsed = Number(value);
        q = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
      }
    }
    ranges.push({ type, subtype, q });
  }
  return ranges;
}

function specificity(range: Range): number {
  if (range.type === "*") return 0;
  if (range.subtype === "*") return 1;
  return 2;
}

/** The q-value the client gives to `produced`: from its most specific matching range, else 0. */
export function quality(produced: Representation, ranges: Range[]): number {
  const [type, subtype] = produced.split("/");
  let best: Range | undefined;
  for (const range of ranges) {
    const matches =
      (range.type === type && range.subtype === subtype) ||
      (range.type === type && range.subtype === "*") ||
      (range.type === "*" && range.subtype === "*");
    if (matches && (!best || specificity(range) > specificity(best))) best = range;
  }
  return best ? best.q : 0;
}

/** The representation to serve, or null when nothing we produce is acceptable (406). */
export function negotiate(accept: string | null | undefined): Representation | null {
  // A missing (or blank) Accept header means any media type is acceptable.
  if (!accept?.trim()) return DEFAULT;
  const ranges = parseAccept(accept);
  const html = quality("text/html", ranges);
  const markdown = quality("text/markdown", ranges);
  const top = Math.max(html, markdown);
  if (top === 0) return null;
  return markdown > html ? "text/markdown" : DEFAULT;
}

/** Plain-text 406 body listing what is available, as RFC 9110 recommends. */
export function notAcceptableBody(accept: string): string {
  return `This resource is available in:\n${REPRESENTATIONS.map((t) => `- ${t}`).join("\n")}\n\nYou requested: ${accept}\n`;
}
