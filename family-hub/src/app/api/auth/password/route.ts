import { NextResponse, type NextRequest } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { parseAllowlist } from "@/lib/auth/allowlist";
import { setSessionCookie } from "@/lib/auth/cookie";
import { isLockedOut, passwordMatches, recordFailure } from "@/lib/auth/password";
import { env } from "@/lib/env";

/** Family-password sign-in. Disabled unless APP_PASSWORD (≥ 12 chars) is set. */
export async function POST(req: NextRequest) {
  const base = await getAppUrl();
  const back = (code: string) => NextResponse.redirect(`${base}/login?error=${code}`, { status: 303 });
  if (!env.appPassword) return back("password_disabled");

  const owner = env.mailboxOwner || parseAllowlist(process.env.ALLOWED_EMAILS)[0];
  if (!owner) return back("no_allowlist");

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  if (await isLockedOut(ip)) return back("locked");

  const form = await req.formData();
  const submitted = String(form.get("password") ?? "");
  if (!passwordMatches(submitted, env.appPassword)) {
    await recordFailure(ip);
    await new Promise((r) => setTimeout(r, 600));
    return back("bad_password");
  }
  await setSessionCookie({ email: owner, name: "Család" });
  return NextResponse.redirect(`${base}/`, { status: 303 });
}
