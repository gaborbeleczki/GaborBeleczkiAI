import { convert } from "html-to-text";

export type GmailHeader = { name: string; value: string };
export type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
};
export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

export type Address = { name: string | null; email: string };

export type ParsedEmail = {
  id: string;
  threadId: string;
  from: Address;
  to: Address[];
  cc: Address[];
  replyTo: Address[];
  subject: string;
  date: Date;
  labels: string[];
  snippet: string;
  listId: string | null;
  hasUnsubscribe: boolean;
  text: string;
  links: { text: string; href: string }[];
  attachments: { filename: string; mimeType: string }[];
};

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function parseAddress(raw: string): Address | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  const e = s.match(/[^\s<>"]+@[^\s<>"]+/);
  return e ? { name: null, email: e[0].toLowerCase() } : null;
}

export function parseAddressList(raw: string | undefined): Address[] {
  if (!raw) return [];
  // split on commas that are not inside quotes
  const out: Address[] = [];
  let cur = "";
  let q = false;
  for (const ch of raw) {
    if (ch === '"') q = !q;
    if (ch === "," && !q) {
      const a = parseAddress(cur);
      if (a) out.push(a);
      cur = "";
    } else cur += ch;
  }
  const a = parseAddress(cur);
  if (a) out.push(a);
  return out;
}

function charsetOf(part: GmailPart): string {
  const ct = part.headers?.find((h) => h.name.toLowerCase() === "content-type")?.value ?? "";
  const m = ct.match(/charset="?([^";\s]+)"?/i);
  return (m?.[1] ?? "utf-8").toLowerCase();
}

export function decodeBody(data: string, charset = "utf-8"): string {
  const bytes = Buffer.from(data, "base64url");
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export function htmlToPlain(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "style", format: "skip" },
      { selector: "script", format: "skip" },
    ],
  });
}

const LINK_BLOCK = /(unsubscribe|leiratkoz|optout|opt-out|preferences|privacy|adatvedelem|mailto:|list-manage|\/o\/|tracking|pixel|facebook\.com|instagram\.com|twitter\.com|x\.com\/|linkedin\.com\/(?!pulse)|apps\.apple|play\.google)/i;

export function extractLinks(html: string, max = 40): { text: string; href: string }[] {
  const out: { text: string; href: string }[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < max) {
    const href = decodeEntities(m[1].trim());
    if (!/^https?:\/\//i.test(href) || LINK_BLOCK.test(href)) continue;
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (!text || text.length < 3) continue;
    const key = href.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: text.slice(0, 140), href: href.slice(0, 500) });
  }
  return out;
}

/** Removes mailing-list footers and excess whitespace; keeps forwarded content (it often holds the real instructions). */
export function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\n--\s*\nAzért kapta ezt az üzenetet[\s\S]*$/i, "")
    .replace(/\nYou received this message because you are subscribed to the Google Groups[\s\S]*$/i, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseGmailMessage(m: GmailMessage): ParsedEmail {
  const headers = new Map<string, string>();
  for (const h of m.payload?.headers ?? []) {
    const k = h.name.toLowerCase();
    if (!headers.has(k)) headers.set(k, h.value);
  }
  const plain: string[] = [];
  const html: string[] = [];
  const attachments: { filename: string; mimeType: string }[] = [];

  const walk = (p: GmailPart | undefined) => {
    if (!p) return;
    const mt = (p.mimeType ?? "").toLowerCase();
    if (p.filename) {
      attachments.push({ filename: p.filename, mimeType: p.mimeType ?? "application/octet-stream" });
    } else if (mt === "text/plain" && p.body?.data) {
      plain.push(decodeBody(p.body.data, charsetOf(p)));
    } else if (mt === "text/html" && p.body?.data) {
      html.push(decodeBody(p.body.data, charsetOf(p)));
    }
    p.parts?.forEach(walk);
  };
  walk(m.payload);

  const htmlJoined = html.join("\n");
  const text = cleanText(plain.length ? plain.join("\n\n") : htmlJoined ? htmlToPlain(htmlJoined) : (m.snippet ?? ""));
  const from = parseAddress(headers.get("from") ?? "") ?? { name: null, email: "" };

  return {
    id: m.id,
    threadId: m.threadId,
    from,
    to: parseAddressList(headers.get("to")),
    cc: parseAddressList(headers.get("cc")),
    replyTo: parseAddressList(headers.get("reply-to")),
    subject: headers.get("subject") ?? "(nincs tárgy)",
    date: m.internalDate ? new Date(Number(m.internalDate)) : new Date(headers.get("date") ?? Date.now()),
    labels: m.labelIds ?? [],
    snippet: decodeEntities(m.snippet ?? ""),
    listId: headers.get("list-id") ?? null,
    hasUnsubscribe: headers.has("list-unsubscribe"),
    text,
    links: htmlJoined ? extractLinks(htmlJoined) : [],
    attachments,
  };
}
