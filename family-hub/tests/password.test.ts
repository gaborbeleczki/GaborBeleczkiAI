import { describe, expect, it } from "vitest";
import { passwordMatches } from "@/lib/auth/password";

describe("family password", () => {
  it("matches only the exact password", () => {
    expect(passwordMatches("correct horse battery", "correct horse battery")).toBe(true);
    expect(passwordMatches("correct horse batter", "correct horse battery")).toBe(false);
    expect(passwordMatches("", "correct horse battery")).toBe(false);
  });
  it("is disabled when no password is configured", () => {
    expect(passwordMatches("", "")).toBe(false);
    expect(passwordMatches("anything", "")).toBe(false);
  });
});
