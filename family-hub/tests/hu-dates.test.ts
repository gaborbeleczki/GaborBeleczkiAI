import { describe, expect, it } from "vitest";
import { findAmount, findDate, findTime, resolveWeekday } from "@/lib/rules/hu-dates";

const SAT = "2026-11-21"; // Saturday
const TUE = "2026-11-17";

describe("Hungarian date parsing", () => {
  it("resolves weekdays relative to the send date", () => {
    expect(resolveWeekday(1, SAT, false)).toBe("2026-11-23"); // weekend mail → next week
    expect(resolveWeekday(4, TUE, false)).toBe("2026-11-19"); // later this week
    expect(resolveWeekday(1, TUE, false)).toBe("2026-11-23"); // already passed → next week
    expect(resolveWeekday(3, TUE, true)).toBe("2026-11-25"); // "jövő szerdán"
  });
  it("finds dates in teacher sentences", () => {
    expect(findDate("Csütörtökön Luca napi készülődés.", SAT)).toMatchObject({ date: "2026-11-26", precision: "exact" });
    expect(findDate("az osztálykarácsony december 17-én lesz", SAT)).toMatchObject({ date: "2026-12-17" });
    expect(findDate("a dobozokat a december2- 7- ig lehet behozni", SAT)).toMatchObject({ date: "2026-12-02", endDate: "2026-12-07" });
    expect(findDate("a jövő héten írunk témazárót", TUE)).toMatchObject({ date: "2026-11-23", endDate: "2026-11-27", precision: "week" });
    expect(findDate("Sikeres jelentkezés - 2026. 11. 17. 14:30:00", SAT)).toMatchObject({ date: "2026-11-17", time: "14:30" });
    expect(findDate("Beérkezési határidő 2026.11.25.", SAT)).toMatchObject({ date: "2026-11-25" });
    expect(findDate("holnap hozzák a füzetet", TUE)).toMatchObject({ date: "2026-11-18" });
    expect(findDate("január 8-án kezdődik", "2026-12-20")).toMatchObject({ date: "2027-01-08" });
    expect(findDate("Kedves Szülők, köszönöm a segítséget", SAT)).toBeNull();
  });
  it("finds times and amounts", () => {
    expect(findTime("14.00-től várjuk a szülőket")).toBe("14:00");
    expect(findTime("rajt: 13:25")).toBe("13:25");
    expect(findTime("17 órától")).toBe("17:00");
    expect(findTime("a 3. órában kezdjük")).toBeNull();
    expect(findAmount("Megrendelés összege: 7 137,00 Ft")).toBe(7137);
    expect(findAmount("Számlázott összeg 5 939 Ft")).toBe(5939);
    expect(findAmount("12.500 Ft-ot kérünk")).toBe(12500);
    expect(findAmount("3000 forint")).toBe(3000);
    expect(findAmount("2/3-ának sikerült")).toBeNull();
  });
});
