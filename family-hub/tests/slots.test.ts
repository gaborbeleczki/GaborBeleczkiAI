import { describe, expect, it } from "vitest";
import { findSlot } from "@/lib/sync/slots";
import { localToDate } from "@/lib/time";

const busy = (date: string, from: string, to: string) => ({ start: localToDate(date, from), end: localToDate(date, to) });

describe("findSlot", () => {
  it("returns the first free slot in the window", () => {
    expect(findSlot({ date: "2026-11-24", window: ["16:30", "19:30"], duration: 30, busy: [] })).toEqual({ start: "16:30", end: "17:00" });
  });
  it("skips busy time from any calendar", () => {
    const b = [busy("2026-11-24", "16:00", "17:15"), busy("2026-11-24", "17:30", "18:00")];
    expect(findSlot({ date: "2026-11-24", window: ["16:30", "19:30"], duration: 30, busy: b })).toEqual({ start: "18:00", end: "18:30" });
  });
  it("can prefer the latest slot (evening tasks)", () => {
    expect(findSlot({ date: "2026-11-24", window: ["18:00", "21:00"], duration: 15, busy: [], preferLate: true })).toEqual({ start: "20:45", end: "21:00" });
  });
  it("returns null when the window is full", () => {
    expect(findSlot({ date: "2026-11-24", window: ["17:00", "18:00"], duration: 30, busy: [busy("2026-11-24", "16:00", "19:00")] })).toBeNull();
  });
});
