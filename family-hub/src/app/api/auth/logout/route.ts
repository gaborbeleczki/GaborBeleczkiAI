import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookie";
import { getAppUrl } from "@/lib/app-url";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.redirect(`${await getAppUrl()}/login`, { status: 303 });
}
