import { describe, expect, it } from "vitest";
import { classifyEmail } from "@/lib/sync/classify";
import { email, family } from "./fixtures";

describe("classifyEmail", () => {
  it("assigns class-group mail from the teacher to the right kid", () => {
    const c = classifyEmail(email({ from: { name: "Kovács Éva", email: "kovacs.eva@gmail.com" }, to: [{ name: null, email: "harmadik-a@googlegroups.com" }], subject: "Jövő hét" }), family);
    expect(c.category).toBe("school");
    expect(c.mode).toBe("extract");
    expect(c.kidIds).toEqual(["bence"]);
  });

  it("uses the class group, not the subject teacher's kid list, for direct mail", () => {
    const c = classifyEmail(email({ from: { name: "Nagy Péter", email: "nagy.peter@gmail.com" }, to: [{ name: null, email: "masodik-b@googlegroups.com" }] }), family);
    expect(c.kidIds).toEqual(["lili"]);
  });

  it("detects forwarded content from another teacher", () => {
    const c = classifyEmail(
      email({
        from: { name: "Kovács Éva", email: "kovacs.eva@gmail.com" },
        to: [{ name: null, email: "harmadik-a@googlegroups.com" }],
        subject: "Fwd: angol témazáró",
        text: "---------- Forwarded message ---------\nFeladó: Nagy Péter <nagy.peter@gmail.com>\nKedves Szülők!",
      }),
      family,
    );
    expect(c.forwardedFrom?.name).toBe("Nagy Péter");
    expect(c.kidIds).toEqual(["bence"]);
  });

  it("matches class groups by List-Id too", () => {
    const c = classifyEmail(email({ to: [{ name: null, email: "anya@example.com" }], listId: "<masodik-b.googlegroups.com>", subject: "Kirándulás" }), family);
    expect(c.kidIds).toEqual(["lili"]);
  });

  it("recognises Kréta notifications and the kid named in them", () => {
    const c = classifyEmail(email({ from: { name: null, email: "no-reply@e-kreta.hu" }, subject: "KRÉTA e-Ügyintézés: új üzenet", text: "Címzett: Anya (Minta Lili)" }), family);
    expect(c.category).toBe("kreta");
    expect(c.kidIds).toEqual(["lili"]);
  });

  it("routes SZMK, menza and treasurer mail", () => {
    expect(classifyEmail(email({ subject: "Fw: [minta-szmk] Papírgyűjtés" }), family).category).toBe("szmk");
    expect(classifyEmail(email({ from: { name: null, email: "multischool@ms.example.hu" }, text: "Minta Bence (3.a) számára" }), family)).toMatchObject({ category: "school_money", kidIds: ["bence"] });
    expect(classifyEmail(email({ from: { name: null, email: "penz@example.com" } }), family)).toMatchObject({ category: "school_money", kidIds: ["lili"] });
  });

  it("never sends security / one-time-code mail to the AI", () => {
    const c = classifyEmail(email({ subject: "016172 - Your Spotify login code" }), family);
    expect(c.mode).toBe("skip");
    expect(c.category).toBe("security");
  });

  it("separates bills, newsletters and promotions", () => {
    expect(classifyEmail(email({ subject: "Telekom számlaértesítő", from: { name: null, email: "noreply@telekom.hu" } }), family).category).toBe("finance");
    expect(classifyEmail(email({ subject: "Cyber ajánlatok", from: { name: null, email: "noreply@telekom.hu" }, labels: ["CATEGORY_PROMOTIONS"] }), family).category).toBe("promo");
    expect(classifyEmail(email({ from: { name: null, email: "lenny@substack.com" } }), family)).toMatchObject({ category: "newsletter", mode: "triage" });
    expect(classifyEmail(email({ labels: ["CATEGORY_PROMOTIONS"] }), family).mode).toBe("skip");
    expect(classifyEmail(email({ from: { name: null, email: "x@spam.example.com" } }), family).category).toBe("ignore");
  });

  it("falls back to triage for personal mail", () => {
    expect(classifyEmail(email({ subject: "Szia, holnap?" }), family)).toMatchObject({ category: "other", mode: "triage" });
  });
});
