import { describe, expect, it } from "vitest";

import { customValueFilterVariants, formatCustomValue, normalizeCustomValue, toIsoDate, toNumber, validateCustomValue } from "./custom-fields";

describe("valores de campos personalizados", () => {
  it("fechas: dd/mm/aaaa y ISO, rechaza fechas inexistentes", () => {
    expect(toIsoDate("15/03/2026")).toBe("2026-03-15");
    expect(toIsoDate("5-3-2026")).toBe("2026-03-05");
    expect(toIsoDate("2026-03-15")).toBe("2026-03-15");
    expect(toIsoDate("31/02/2026")).toBeNull();
    expect(toIsoDate("mañana")).toBeNull();
  });

  it("números en formato es-AR y en formato punto decimal", () => {
    expect(toNumber("1.234,5")).toBe(1234.5);
    expect(toNumber("1,234.5")).toBe(1234.5);
    expect(toNumber("$ 1.500")).toBe(1500);
    expect(toNumber("12,5")).toBe(12.5);
    expect(toNumber("3.75")).toBe(3.75);
    expect(toNumber("abc")).toBeNull();
  });

  it("normaliza a la forma canónica que usan editor, filtros y CSV", () => {
    expect(normalizeCustomValue("date", "15/03/2026")).toBe("2026-03-15");
    expect(normalizeCustomValue("boolean", "Sí")).toBe("true");
    expect(normalizeCustomValue("boolean", "no")).toBe("false");
    expect(normalizeCustomValue("currency", "1.234,5")).toBe("1234.5");
    expect(normalizeCustomValue("multiselect", "A;B , C")).toBe("A, B, C");
    expect(normalizeCustomValue("text", "  hola ")).toBe("hola");
    expect(normalizeCustomValue("text", "   ")).toBeNull();
  });

  it("formatea para mostrar, también datos viejos sin normalizar", () => {
    expect(formatCustomValue("date", "2026-03-15")).toBe("15/03/2026");
    expect(formatCustomValue("date", "15/03/2026")).toBe("15/03/2026");
    expect(formatCustomValue("boolean", "true")).toBe("Sí");
    expect(formatCustomValue("boolean", "Sí")).toBe("Sí");
    expect(formatCustomValue("currency", "1234.5")).toBe("$1.234,5");
  });

  it("valida por tipo", () => {
    const info = (type: string, options: string[] = []) => ({ type, options, label: "Campo" });
    expect(validateCustomValue(info("number"), "12a")).toMatch(/número/);
    expect(validateCustomValue(info("date"), "31/02/2026")).toMatch(/fecha/);
    expect(validateCustomValue(info("select", ["A", "B"]), "C")).toMatch(/opciones/);
    expect(validateCustomValue(info("multiselect", ["A", "B"]), "A, B")).toBeNull();
    expect(validateCustomValue(info("email"), "x@")).toMatch(/email/);
    expect(validateCustomValue(info("number"), "")).toBeNull();
  });

  it("los filtros aceptan formas equivalentes", () => {
    expect(customValueFilterVariants("boolean", "sí").equals).toContain("true");
    expect(customValueFilterVariants("date", "2026-03-15").contains).toEqual(["2026-03-15", "15/03/2026"]);
    expect(customValueFilterVariants("number", "1.500").equals).toEqual(["1500"]);
  });
});
