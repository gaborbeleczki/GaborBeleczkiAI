import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { runMailSync } from "@/lib/sync/run";

export const maxDuration = 300;

export async function POST() {
  if (!(await getSessionUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await runMailSync({ trigger: "manual" });
  return NextResponse.json(result);
}
