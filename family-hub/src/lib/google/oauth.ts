import "server-only";
import { createHash } from "node:crypto";
import { env } from "../env";
import { loadToken, saveToken } from "../tokens";

export const SCOPES_LOGIN = ["openid", "email", "profile"];
export const SCOPES_MAILBOX = [
  ...SCOPES_LOGIN,
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildGoogleAuthUrl(opts: {
  redirectUri: string;
  state: string;
  codeVerifier: string;
  mode: "login" | "connect";
  loginHint?: string;
}): string {
  const p = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: (opts.mode === "connect" ? SCOPES_MAILBOX : SCOPES_LOGIN).join(" "),
    state: opts.state,
    code_challenge: pkceChallenge(opts.codeVerifier),
    code_challenge_method: "S256",
    include_granted_scopes: "true",
  });
  if (opts.mode === "connect") {
    p.set("access_type", "offline");
    p.set("prompt", "consent");
  } else {
    p.set("prompt", "select_account");
  }
  if (opts.loginHint) p.set("login_hint", opts.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeGoogleCode(code: string, redirectUri: string, codeVerifier: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok) {
    const err = new GoogleAuthError(json.error_description || json.error || "token exchange failed");
    (err as GoogleAuthError & { code?: string }).code = json.error;
    throw err;
  }
  return json;
}

export async function fetchGoogleUser(accessToken: string) {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new GoogleAuthError("userinfo failed");
  return (await res.json()) as { email: string; email_verified: boolean; name?: string; picture?: string };
}

/** Access token for the mailbox owner's Gmail + Calendar (refreshes as needed). */
export async function getGoogleAccessToken(): Promise<string> {
  const t = await loadToken("google");
  if (!t?.refreshToken) throw new GoogleAuthError("A Gmail/Naptár kapcsolat nincs beállítva.");
  if (t.accessToken && t.expiresAt && t.expiresAt.getTime() > Date.now() + 60_000) return t.accessToken;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      refresh_token: t.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok) {
    throw new GoogleAuthError(
      json.error === "invalid_grant"
        ? "A Google hozzáférés lejárt vagy visszavonták – kapcsold össze újra a Beállításokban."
        : json.error_description || json.error || "token refresh failed",
    );
  }
  await saveToken("google", { accessToken: json.access_token, expiresIn: json.expires_in, scope: json.scope ?? t.scope });
  return json.access_token;
}

export async function googleConnection() {
  const t = await loadToken("google");
  return {
    connected: Boolean(t?.refreshToken),
    account: t?.account ?? null,
    hasGmail: Boolean(t?.scope?.includes("gmail.readonly")),
    hasCalendar: Boolean(t?.scope?.includes("calendar.events")),
  };
}

/** Thin fetch wrapper for Google REST APIs with JSON + error handling. */
export async function gfetch<T>(url: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const token = await getGoogleAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    return gfetch<T>(url, init, attempt + 1);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Google API ${res.status}: ${text.slice(0, 300)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (text ? JSON.parse(text) : undefined) as T;
}
