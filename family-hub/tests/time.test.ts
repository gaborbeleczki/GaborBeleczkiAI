import { describe, expect, it } from "vitest";
import { addDaysISO, diffDays, formatHuf, huDate, huRelative, isHHMM, isISODate, localToDate, mondayOf, toLocal, weekdayISO } from "@/lib/time";

describe("time helpers (Europe/Budapest)", () => {
  it("validates dates and times", () => {
    expect(isISODate("2026-11-23")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("23/11/2026")).toBe(false);
    expect(isHHMM("14:00")).toBe(true);
    expect(isHHMM("24:00")).toBe(false);
  });

  it("does calendar arithmetic", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayISO("2026-11-21")).toBe(6);
    expect(mondayOf("2026-11-22")).toBe("2026-11-16");
    expect(diffDays("2026-11-21", "2026-11-26")).toBe(5);
  });

  it("converts Budapest wall-clock time across DST", () => {
    expect(localToDate("2026-11-23", "14:00").toISOString()).toBe("2026-11-23T13:00:00.000Z");
    expect(localToDate("2026-06-01", "14:00").toISOString()).toBe("2026-06-01T12:00:00.000Z");
    expect(toLocal(new Date("2026-11-21T23:30:00Z"))).toEqual({ date: "2026-11-22", time: "00:30" });
  });

  it("formats in Hungarian", () => {
    expect(huDate("2026-11-26", { long: true, weekday: true })).toBe("november 26., csütörtök");
    expect(huRelative("2026-11-22", "2026-11-21")).toBe("holnap");
    expect(huRelative("2026-11-26", "2026-11-21")).toBe("csütörtök");
    expect(huRelative("2026-11-19", "2026-11-21")).toBe("2 napja");
    expect(formatHuf(7137).replace(/\s/g, " ")).toBe("7137 Ft");
    expect(formatHuf(12000).replace(/\s/g, " ")).toBe("12 000 Ft");
  });
});
