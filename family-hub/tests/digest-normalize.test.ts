import { describe, expect, it } from "vitest";
import { normalizeDigest } from "@/lib/digest-normalize";

describe("normalizeDigest", () => {
  it("accepts a per-child week_ahead object (the shape that crashed /napi)", () => {
    const d = normalizeDigest({
      date: "2026-11-25",
      headline: "Sűrű hét",
      focus: ["a", 2],
      week_ahead: { vencel: ["Angol témazáró", "Luca napi készülődés"], zoja: ["Unit 2"], neva: [], csalad: "AYCM díj" },
      suggested_actions: [{ title: "Fizetés", why: "lejárt", kind: "pay", urgency: "today" }, { title: "X", kind: "weird" }, null],
    });
    expect(typeof d.week_ahead).toBe("string");
    expect(d.week_ahead_groups?.map((g) => g.key)).toEqual(["vencel", "zoja", "csalad"]);
    expect(d.week_ahead_groups?.[0].lines).toEqual(["Angol témazáró", "Luca napi készülődés"]);
    expect(d.focus).toEqual(["a", "2"]);
    expect(d.suggested_actions).toHaveLength(2);
    expect(d.suggested_actions[1]).toMatchObject({ kind: "other", urgency: "this_week", item_id: "", email_id: "" });
    expect(d.reading_pick_ids).toEqual([]);
  });
  it("keeps a plain string week_ahead and survives garbage", () => {
    expect(normalizeDigest({ week_ahead: "Csendes hét" }).week_ahead).toBe("Csendes hét");
    const g = normalizeDigest(null, "2026-11-24");
    expect(g.date).toBe("2026-11-24");
    expect(g.focus).toEqual([]);
    expect(g.week_ahead_groups).toEqual([]);
  });
});
