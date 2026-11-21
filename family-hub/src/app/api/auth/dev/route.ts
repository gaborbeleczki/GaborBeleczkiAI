import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookie";
import { parseAllowlist } from "@/lib/auth/allowlist";
import { getAppUrl } from "@/lib/app-url";

/** Local development sign-in. Hard-disabled in production builds. */
export async function GET() {
  if (process.env.NODE_ENV === "production" || process.env.DEV_LOGIN !== "1") {
    return new NextResponse("Not found", { status: 404 });
  }
  const email = parseAllowlist(process.env.ALLOWED_EMAILS)[0];
  if (!email) return new NextResponse("Set ALLOWED_EMAILS", { status: 400 });
  await setSessionCookie({ email, name: "Fejlesztő" });
  return NextResponse.redirect(`${await getAppUrl()}/`);
}
