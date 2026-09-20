import { describe, expect, it } from "vitest";

import { addDaysKey, dayKey, shiftAnchor, timeLabel, toInstant, visibleDays, weekdayIndex } from "./calendar-dates";

describe("calendar-dates", () => {
  it("toInstant/dayKey/timeLabel son consistentes en la zona de la app (UTC-3)", () => {
    const d = toInstant("2026-09-25", "15:00");
    expect(d.toISOString()).toBe("2026-09-25T18:00:00.000Z");
    expect(dayKey(d)).toBe("2026-09-25");
    expect(timeLabel(d)).toBe("15:00");
    // 23:30 local cae en el día siguiente en UTC pero sigue siendo el mismo día local
    expect(dayKey(toInstant("2026-09-25", "23:30"))).toBe("2026-09-25");
  });

  it("la semana empieza el lunes", () => {
    expect(weekdayIndex("2026-09-21")).toBe(0); // lunes
    expect(visibleDays("week", "2026-09-24")[0]).toBe("2026-09-21");
    expect(visibleDays("week", "2026-09-24")).toHaveLength(7);
  });

  it("la grilla mensual son semanas completas", () => {
    const days = visibleDays("month", "2026-09-15");
    expect(days.length % 7).toBe(0);
    expect(days).toContain("2026-09-01");
    expect(days).toContain("2026-09-30");
  });

  it("navegación entre períodos", () => {
    expect(shiftAnchor("day", "2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftAnchor("week", "2026-09-30", -1)).toBe("2026-09-23");
    expect(shiftAnchor("month", "2026-01-15", -1)).toBe("2025-12-01");
    expect(addDaysKey("2026-02-28", 1)).toBe("2026-03-01");
  });
});
