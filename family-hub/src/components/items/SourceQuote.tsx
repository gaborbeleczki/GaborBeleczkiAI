import { Mail, Quote } from "lucide-react";
import { gmailUrl } from "@/lib/google/gmail";

/** The verbatim sentence an item was extracted from, with a link to the original email. */
export function SourceQuote({ quote, emailId, contact, account, compact }: { quote: string | null; emailId: string | null; contact?: string | null; account: string | null; compact?: boolean }) {
  if (!quote) return null;
  return (
    <details className="group/q mt-1.5 text-[12.5px]">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <Quote className="h-3 w-3" />
        <span className="group-open/q:hidden">{compact ? "forrás" : "Forrás-idézet"}</span>
        <span className="hidden group-open/q:inline">Elrejtés</span>
      </summary>
      <blockquote className="mt-1.5 rounded-xl border-l-2 border-accent/60 bg-surface-2 px-3 py-2 italic leading-snug text-ink-2">
        „{quote}”
        <span className="mt-1 flex flex-wrap items-center gap-2 not-italic text-[11px] text-muted">
          {contact && <span>— {contact}</span>}
          {emailId && (
            <a href={gmailUrl(emailId, account)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:text-ink hover:underline">
              <Mail className="h-3 w-3" /> eredeti levél megnyitása
            </a>
          )}
        </span>
      </blockquote>
    </details>
  );
}
