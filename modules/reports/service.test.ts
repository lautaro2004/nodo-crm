import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { timeSeries, countBy, parseReportFilters, toKey } = await import("./service");

describe("timeSeries", () => {
  it("por día en períodos cortos, con buckets vacíos incluidos", () => {
    const from = new Date("2026-10-01T03:00:00Z");
    const to = new Date("2026-10-03T03:00:00Z");
    const s = timeSeries([new Date("2026-10-02T15:00:00Z"), new Date("2026-10-02T20:00:00Z")], from, to);
    expect(s.unit).toBe("day");
    expect(s.points).toEqual([
      { key: "2026-10-01", count: 0 },
      { key: "2026-10-02", count: 2 },
      { key: "2026-10-03", count: 0 },
    ]);
  });

  it("agrupa por semana (lunes) en períodos largos", () => {
    const from = new Date("2026-08-01T03:00:00Z");
    const to = new Date("2026-10-15T03:00:00Z");
    const s = timeSeries([new Date("2026-10-14T15:00:00Z")], from, to);
    expect(s.unit).toBe("week");
    expect(s.points.at(-1)).toEqual({ key: "2026-10-12", count: 1 });
  });

  it("usa la fecha de Argentina (UTC-3) para decidir el día", () => {
    expect(toKey(new Date("2026-10-02T02:00:00Z"))).toBe("2026-10-01");
  });
});

describe("parseReportFilters", () => {
  it("por defecto: últimos 30 días hasta hoy", () => {
    const f = parseReportFilters({}, "u1", new Date("2026-10-17T15:00:00Z"));
    expect(f.toKey).toBe("2026-10-17");
    expect(f.fromKey).toBe("2026-09-18");
  });
  it("respeta un rango personalizado y 'me' como responsable", () => {
    const f = parseReportFilters({ range: "custom", from: "2026-09-01", to: "2026-09-30", ownerId: "me" }, "u1");
    expect([f.fromKey, f.toKey, f.ownerId]).toEqual(["2026-09-01", "2026-09-30", "u1"]);
  });
  it("este mes", () => {
    const f = parseReportFilters({ range: "month" }, "u1", new Date("2026-10-17T15:00:00Z"));
    expect(f.fromKey).toBe("2026-10-01");
  });
});

describe("countBy", () => {
  it("ordena de mayor a menor", () => {
    expect(countBy(["a", "b", "b"], (x) => x)).toEqual([
      { label: "b", count: 2 },
      { label: "a", count: 1 },
    ]);
  });
});
