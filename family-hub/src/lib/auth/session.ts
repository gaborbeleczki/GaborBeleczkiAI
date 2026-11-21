import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowed, parseAllowlist } from "./allowlist";
import { SESSION_COOKIE, verifySession, type SessionUser } from "./token";

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await verifySession(token);
  if (!user) return null;
  if (!isAllowed(user.email, parseAllowlist(process.env.ALLOWED_EMAILS))) return null;
  return user;
}

/** Use at the top of every page and Server Action. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
