import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { createOAuthState } from "@/lib/auth/oauth-state";
import { getSessionUser } from "@/lib/auth/session";
import { spotifyAuthUrl, spotifyConfigured } from "@/lib/spotify";

export async function GET() {
  const base = await getAppUrl();
  if (!(await getSessionUser())) return NextResponse.redirect(`${base}/login`);
  if (!spotifyConfigured()) return NextResponse.redirect(`${base}/beallitasok?error=spotify_not_configured`);
  const s = await createOAuthState("spotify", "connect");
  return NextResponse.redirect(spotifyAuthUrl(`${base}/api/spotify/callback`, s.state));
}
