import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("toCsv", () => {
  it("usa ; con BOM y escapa comillas, separadores y saltos", () => {
    const csv = toCsv(["a", "b"], [["x;y", 'di "hola"'], ["línea\nnueva", 3]]);
    expect(csv.startsWith("﻿a;b\r\n")).toBe(true);
    expect(csv).toContain('"x;y";"di ""hola"""');
    expect(csv).toContain('"línea\nnueva";3');
  });

  it("neutraliza fórmulas (CSV injection)", () => {
    expect(toCsv(["a"], [["=HYPERLINK(1)"], ["+1"], ["@x"]])).toContain("'=HYPERLINK(1)\r\n'+1\r\n'@x");
  });

  it("fechas como AAAA-MM-DD y vacíos para null", () => {
    expect(toCsv(["d", "n"], [[new Date("2026-10-17T12:00:00Z"), null]])).toContain("2026-10-17;");
  });
});
