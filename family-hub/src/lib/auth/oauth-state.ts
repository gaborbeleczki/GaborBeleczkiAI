import "server-only";
import { cookies } from "next/headers";
import { decrypt, encrypt, randomToken } from "../crypto";

const COOKIE = "fh_oauth";

export type OAuthState = { state: string; verifier: string; mode: string; provider: "google" | "spotify"; ts: number; next?: string };

export async function createOAuthState(provider: OAuthState["provider"], mode: string, next?: string): Promise<OAuthState> {
  const s: OAuthState = { state: randomToken(24), verifier: randomToken(48), mode, provider, ts: Date.now(), next };
  (await cookies()).set(COOKIE, encrypt(JSON.stringify(s)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return s;
}

export async function consumeOAuthState(provider: OAuthState["provider"], state: string | null): Promise<OAuthState | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  jar.delete(COOKIE);
  if (!raw || !state) return null;
  try {
    const s = JSON.parse(decrypt(raw)) as OAuthState;
    if (s.provider !== provider || s.state !== state || Date.now() - s.ts > 600_000) return null;
    return s;
  } catch {
    return null;
  }
}
