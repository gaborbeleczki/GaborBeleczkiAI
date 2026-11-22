import { after, NextResponse, type NextRequest } from "next/server";
import { runMailSync } from "@/lib/sync/run";

export const maxDuration = 300;
import { getAppUrl } from "@/lib/app-url";
import { isAllowed, parseAllowlist, sameEmail } from "@/lib/auth/allowlist";
import { setSessionCookie } from "@/lib/auth/cookie";
import { consumeOAuthState } from "@/lib/auth/oauth-state";
import { env } from "@/lib/env";
import { exchangeGoogleCode, fetchGoogleUser, googleConnection } from "@/lib/google/oauth";
import { saveToken } from "@/lib/tokens";

export async function GET(req: NextRequest) {
  const base = await getAppUrl();
  const fail = (code: string) => NextResponse.redirect(`${base}/login?error=${code}`);
  const p = req.nextUrl.searchParams;
  if (p.get("error")) return fail("access_denied");

  const state = await consumeOAuthState("google", p.get("state"));
  const code = p.get("code");
  if (!state || !code) return fail("invalid_state");

  try {
    const tokens = await exchangeGoogleCode(code, `${base}/api/auth/google/callback`, state.verifier);
    const user = await fetchGoogleUser(tokens.access_token);
    if (!user.email_verified || !isAllowed(user.email, parseAllowlist(process.env.ALLOWED_EMAILS))) {
      return fail("not_allowed");
    }
    await setSessionCookie({ email: user.email, name: user.name ?? user.email, picture: user.picture ?? null });

    if (state.mode === "connect") {
      if (env.mailboxOwner && !sameEmail(user.email, env.mailboxOwner)) {
        return NextResponse.redirect(`${base}/beallitasok?error=wrong_mailbox`);
      }
      if (!tokens.scope.includes("gmail.readonly") || !tokens.scope.includes("calendar.events")) {
        return NextResponse.redirect(`${base}/beallitasok?error=missing_scopes`);
      }
      await saveToken("google", {
        account: user.email,
        refreshToken: tokens.refresh_token ?? null,
        accessToken: tokens.access_token,
        expiresIn: tokens.expires_in,
        scope: tokens.scope,
      });
      // first import: the last 30 days of mail, processed in the background
      after(() => runMailSync({ trigger: "connect", lookbackDays: 30 }).then(() => undefined));
      return NextResponse.redirect(`${base}/beallitasok?connected=google`);
    }

    const conn = await googleConnection();
    if (!conn.connected && (!env.mailboxOwner || sameEmail(user.email, env.mailboxOwner))) {
      return NextResponse.redirect(`${base}/beallitasok?welcome=1`);
    }
    return NextResponse.redirect(`${base}/`);
  } catch {
    return fail("oauth_failed");
  }
}
