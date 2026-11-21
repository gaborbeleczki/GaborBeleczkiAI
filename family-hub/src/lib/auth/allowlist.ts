/**
 * Gmail ignores dots and "+tags" in the local part, so first.last@gmail.com and
 * firstlast@gmail.com are the same mailbox. Normalise before comparing.
 */
export function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const [local, domain] = e.split("@");
  if (!local || !domain) return e;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
  }
  return `${local.split("+")[0]}@${domain}`;
}

export function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeEmail(a) === normalizeEmail(b);
}

export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeEmail);
}

export function isAllowed(email: string | null | undefined, allowlist: string[]): boolean {
  if (!email) return false;
  const n = normalizeEmail(email);
  return allowlist.includes(n);
}
