import { normalizeFamily } from "@/lib/family/normalize";
import type { ParsedEmail } from "@/lib/google/mime";

/** Fictional family used by the tests. */
export const family = normalizeFamily({
  familyName: "Minta család",
  parents: [{ name: "Anya", email: "anya@example.com" }],
  kids: [
    { id: "bence", name: "Bence", fullName: "Minta Bence", className: "3.a", color: "sky", classGroupEmails: ["harmadik-a@googlegroups.com"] },
    { id: "lili", name: "Lili", fullName: "Minta Lili", className: "2.b", color: "rose", classGroupEmails: ["masodik-b@googlegroups.com"] },
  ],
  contacts: [
    { name: "Kovács Éva", emails: ["kovacs.eva@gmail.com"], role: "class_teacher", kidIds: ["bence"] },
    { name: "Nagy Péter", emails: ["nagy.peter@gmail.com"], role: "subject_teacher", subject: "Angol", kidIds: ["bence", "lili"] },
    { name: "Pénztáros", emails: ["penz@example.com"], role: "treasurer", kidIds: ["lili"] },
  ],
  sources: {
    kreta: ["e-kreta.hu"],
    szmk: ["[minta-szmk]"],
    menza: ["ms.example.hu"],
    billers: ["telekom.hu"],
    newsletters: ["substack.com"],
    ignore: ["spam.example.com"],
  },
});

export function email(p: Partial<ParsedEmail>): ParsedEmail {
  return {
    id: "m1",
    threadId: "t1",
    from: { name: null, email: "someone@example.com" },
    to: [{ name: null, email: "anya@example.com" }],
    cc: [],
    replyTo: [],
    subject: "Tárgy",
    date: new Date("2026-11-21T08:00:00Z"),
    labels: ["INBOX"],
    snippet: "",
    listId: null,
    hasUnsubscribe: false,
    text: "",
    links: [],
    attachments: [],
    ...p,
  };
}
