import "server-only";
import { gfetch } from "./oauth";
import { parseGmailMessage, type GmailMessage, type ParsedEmail } from "./mime";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export async function listMessageIds(q: string, max = 300): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const p = new URLSearchParams({ q, maxResults: String(Math.min(100, max - ids.length)) });
    if (pageToken) p.set("pageToken", pageToken);
    const res = await gfetch<{ messages?: { id: string }[]; nextPageToken?: string }>(`${BASE}/messages?${p}`);
    ids.push(...(res.messages ?? []).map((m) => m.id));
    pageToken = res.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

export async function getMessage(id: string): Promise<ParsedEmail> {
  const raw = await gfetch<GmailMessage>(`${BASE}/messages/${id}?format=full`);
  return parseGmailMessage(raw);
}

export function gmailUrl(messageId: string, account?: string | null): string {
  const q = account ? `?authuser=${encodeURIComponent(account)}` : "";
  return `https://mail.google.com/mail/${q}#all/${messageId}`;
}
