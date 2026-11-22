import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

/** Public liveness check: initialises the database (runs migrations) and returns no data. */
export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    // server log only – the response never reveals details
    const err = e as { message?: string; code?: string; cause?: { message?: string; code?: string } };
    console.error("health: database unavailable", err.code ?? err.cause?.code ?? "", (err.message ?? "").slice(0, 300), err.cause?.message?.slice(0, 300) ?? "");
    return NextResponse.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
