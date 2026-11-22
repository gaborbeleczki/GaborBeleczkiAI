import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { googleConnection } from "@/lib/google/oauth";
import { syncCalendarFor } from "@/lib/sync/run";

export const maxDuration = 300;

/** Runs after the morning Claude refresh: places every open, dated, approved item on the calendar. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await googleConnection()).hasCalendar) return NextResponse.json({ ok: true, skipped: "calendar_not_connected" });
  const n = await syncCalendarFor(undefined);
  return NextResponse.json({ ok: true, synced: n });
}
