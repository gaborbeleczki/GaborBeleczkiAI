import { describe, expect, it } from "vitest";
import { isAllowed, normalizeEmail, parseAllowlist, sameEmail } from "@/lib/auth/allowlist";

describe("allowlist", () => {
  it("treats Gmail dots and +tags as the same mailbox", () => {
    expect(normalizeEmail("First.Last+school@gmail.com")).toBe("firstlast@gmail.com");
    expect(sameEmail("a.b@googlemail.com", "ab@gmail.com")).toBe(true);
  });
  it("keeps dots for non-Gmail domains", () => {
    expect(normalizeEmail("first.last@example.com")).toBe("first.last@example.com");
    expect(sameEmail("first.last@example.com", "firstlast@example.com")).toBe(false);
  });
  it("only allows listed accounts", () => {
    const list = parseAllowlist("you@gmail.com, partner@example.com");
    expect(isAllowed("y.o.u@gmail.com", list)).toBe(true);
    expect(isAllowed("partner@example.com", list)).toBe(true);
    expect(isAllowed("stranger@gmail.com", list)).toBe(false);
    expect(isAllowed(null, list)).toBe(false);
    expect(isAllowed("you@gmail.com", parseAllowlist(""))).toBe(false);
  });
});
