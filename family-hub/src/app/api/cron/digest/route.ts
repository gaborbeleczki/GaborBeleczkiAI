import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runDigest, runMailSync } from "@/lib/sync/run";
import { googleConnection } from "@/lib/google/oauth";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((await googleConnection()).hasGmail) await runMailSync({ trigger: "cron-digest" });
  const d = await runDigest({ trigger: "cron" });
  return NextResponse.json({ ok: true, date: d.date, actions: d.suggested_actions.length });
}
