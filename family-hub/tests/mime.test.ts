import { describe, expect, it } from "vitest";
import { cleanText, extractLinks, parseAddressList, parseGmailMessage } from "@/lib/google/mime";

const b64 = (s: string, enc: BufferEncoding = "utf8") => Buffer.from(s, enc).toString("base64url");

describe("mime parsing", () => {
  it("parses headers, plain body, attachments and links", () => {
    const html = '<p>Kedves Szülők!</p><a href="https://example.com/cikk?utm=1">Az egész cikk itt</a><a href="https://example.com/unsubscribe">Leiratkozás</a>';
    const m = parseGmailMessage({
      id: "abc",
      threadId: "t",
      labelIds: ["INBOX", "UNREAD"],
      internalDate: String(Date.parse("2026-11-21T07:41:05Z")),
      snippet: "Kedves &amp; Szülők",
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          { name: "From", value: '"Kovács Éva" <KovacsEva@gmail.com>' },
          { name: "To", value: '"Harmadik A, 3.a" <harmadik-a@googlegroups.com>, anya@example.com' },
          { name: "Subject", value: "Jövő hét" },
          { name: "List-Id", value: "<harmadik-a.googlegroups.com>" },
          { name: "List-Unsubscribe", value: "<mailto:x>" },
        ],
        parts: [
          {
            mimeType: "multipart/alternative",
            parts: [
              { mimeType: "text/plain", headers: [{ name: "Content-Type", value: 'text/plain; charset="UTF-8"' }], body: { data: b64("Hétfő: olvasás felmérés\n\n--\nAzért kapta ezt az üzenetet, mert feliratkozott") } },
              { mimeType: "text/html", body: { data: b64(html) } },
            ],
          },
          { mimeType: "application/pdf", filename: "Szavak.pdf", body: { attachmentId: "x", size: 10 } },
        ],
      },
    });
    expect(m.from).toEqual({ name: "Kovács Éva", email: "kovacseva@gmail.com" });
    expect(m.to.map((a) => a.email)).toEqual(["harmadik-a@googlegroups.com", "anya@example.com"]);
    expect(m.text).toBe("Hétfő: olvasás felmérés");
    expect(m.attachments).toEqual([{ filename: "Szavak.pdf", mimeType: "application/pdf" }]);
    expect(m.links).toEqual([{ text: "Az egész cikk itt", href: "https://example.com/cikk?utm=1" }]);
    expect(m.listId).toBe("<harmadik-a.googlegroups.com>");
    expect(m.hasUnsubscribe).toBe(true);
    expect(m.snippet).toBe("Kedves & Szülők");
  });

  it("decodes legacy Hungarian charsets", () => {
    const latin2 = Buffer.from([0x54, 0xe1, 0x72, 0x67, 0x79, 0x3a, 0x20, 0x66, 0xfb, 0x7a, 0xf5]); // "Tárgy: fűző"
    const m = parseGmailMessage({
      id: "x",
      threadId: "x",
      payload: { mimeType: "text/plain", headers: [{ name: "Content-Type", value: "text/plain; charset=iso-8859-2" }], body: { data: latin2.toString("base64url") } },
    });
    expect(m.text).toBe("Tárgy: fűző");
  });

  it("falls back to HTML when there is no plain part", () => {
    const m = parseGmailMessage({ id: "x", threadId: "x", payload: { mimeType: "text/html", body: { data: b64("<div>Szia<br>Holnap <b>9-kor</b></div>") } } });
    expect(m.text).toContain("Holnap 9-kor");
  });

  it("parses quoted display names containing commas", () => {
    expect(parseAddressList('"Doe, John" <john@x.hu>, b@y.hu').map((a) => a.email)).toEqual(["john@x.hu", "b@y.hu"]);
  });

  it("drops tracking/social links and cleans whitespace", () => {
    expect(extractLinks('<a href="https://facebook.com/x">Facebook</a><a href="mailto:a@b">Mail</a>')).toEqual([]);
    expect(cleanText("a  \n\n\n\nb")).toBe("a\n\nb");
  });
});
