import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { runDigest } from "@/lib/sync/run";

export const maxDuration = 300;

export async function POST() {
  if (!(await getSessionUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const d = await runDigest({ trigger: "manual" });
    return NextResponse.json({ ok: true, date: d.date });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
