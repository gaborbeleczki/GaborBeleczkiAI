import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runMailSync, syncCalendarFor } from "@/lib/sync/run";
import { googleConnection } from "@/lib/google/oauth";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await googleConnection()).hasGmail) return NextResponse.json({ ok: true, skipped: "gmail_not_connected" });
  const result = await runMailSync({ trigger: "cron" });
  // nightly: re-place timeboxed blocks around any new calendar conflicts
  if (new URL(req.url).searchParams.get("calendar") === "all") await syncCalendarFor(undefined);
  // counts only – never echo mail content into logs
  return NextResponse.json("locked" in result ? { locked: true } : { ok: true, created: result.created, updated: result.updated, errors: result.errors.length });
}
