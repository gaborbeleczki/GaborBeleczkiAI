import { describe, expect, it } from "vitest";
import { decrypt, encrypt, safeEqual } from "@/lib/crypto";
import { signSession, verifySession } from "@/lib/auth/token";

describe("crypto + sessions", () => {
  it("round-trips encrypted tokens and rejects tampering", () => {
    const c = encrypt("1//refresh-token");
    expect(c).not.toContain("refresh");
    expect(decrypt(c)).toBe("1//refresh-token");
    const parts = c.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
  it("signs and verifies sessions", async () => {
    const t = await signSession({ email: "you@gmail.com", name: "You" });
    expect(await verifySession(t)).toMatchObject({ email: "you@gmail.com", name: "You" });
    expect(await verifySession(t.slice(0, -3) + "abc")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
  it("compares secrets in constant time", () => {
    expect(safeEqual("Bearer abc", "Bearer abc")).toBe(true);
    expect(safeEqual("Bearer abc", "Bearer abd")).toBe(false);
    expect(safeEqual("short", "longer")).toBe(false);
  });
});
