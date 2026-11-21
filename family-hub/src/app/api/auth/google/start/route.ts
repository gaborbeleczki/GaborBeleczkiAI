import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getAppUrl } from "@/lib/app-url";
import { buildGoogleAuthUrl } from "@/lib/google/oauth";
import { createOAuthState } from "@/lib/auth/oauth-state";

export async function GET(req: NextRequest) {
  if (!env.googleClientId || !env.googleClientSecret) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", req.url));
  }
  const mode = req.nextUrl.searchParams.get("mode") === "connect" ? "connect" : "login";
  const s = await createOAuthState("google", mode);
  const url = buildGoogleAuthUrl({
    redirectUri: `${await getAppUrl()}/api/auth/google/callback`,
    state: s.state,
    codeVerifier: s.verifier,
    mode,
    loginHint: mode === "connect" ? env.mailboxOwner || undefined : undefined,
  });
  return NextResponse.redirect(url);
}
