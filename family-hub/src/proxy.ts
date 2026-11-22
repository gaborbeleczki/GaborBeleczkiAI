import { NextResponse, type NextRequest } from "next/server";
import { isAllowed, parseAllowlist } from "@/lib/auth/allowlist";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/**
 * Every route is private. Only signed-in, allow-listed Google accounts get through.
 * Public exceptions: the login page, the OAuth endpoints, cron endpoints (they check
 * their own Bearer secret) and static assets.
 */
const PUBLIC_PREFIXES = ["/login", "/adatvedelem", "/api/auth/", "/api/cron/", "/api/health"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const user = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const allowed = user && isAllowed(user.email, parseAllowlist(process.env.ALLOWED_EMAILS));
  if (allowed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const res = NextResponse.redirect(url);
  if (user && !allowed) res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|robots.txt).*)"],
};
