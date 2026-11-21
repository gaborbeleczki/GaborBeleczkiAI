import { SignJWT, jwtVerify } from "jose";
import { deriveKey } from "../crypto";

export const SESSION_COOKIE = "fh_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SessionUser = { email: string; name: string; picture?: string | null };

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, picture: user.picture ?? null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.email)
    .setIssuedAt()
    .setIssuer("family-hub")
    .setAudience("family-hub")
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(deriveKey("session"));
}

export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, deriveKey("session"), {
      issuer: "family-hub",
      audience: "family-hub",
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    return {
      email: payload.sub,
      name: typeof payload.name === "string" ? payload.name : payload.sub,
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch {
    return null;
  }
}
