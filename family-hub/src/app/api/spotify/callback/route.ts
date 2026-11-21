import { NextResponse, type NextRequest } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { consumeOAuthState } from "@/lib/auth/oauth-state";
import { getSessionUser } from "@/lib/auth/session";
import { exchangeSpotifyCode } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const base = await getAppUrl();
  if (!(await getSessionUser())) return NextResponse.redirect(`${base}/login`);
  const state = await consumeOAuthState("spotify", req.nextUrl.searchParams.get("state"));
  const code = req.nextUrl.searchParams.get("code");
  if (!state || !code) return NextResponse.redirect(`${base}/beallitasok?error=spotify_state`);
  try {
    await exchangeSpotifyCode(code, `${base}/api/spotify/callback`);
    return NextResponse.redirect(`${base}/beallitasok?connected=spotify`);
  } catch {
    return NextResponse.redirect(`${base}/beallitasok?error=spotify_failed`);
  }
}
