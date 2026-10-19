import { describe, expect, it } from "vitest";

import { fallbackLeadName, mapRow, normalizeEmail, normalizePhone, phoneMatchKey } from "./normalize";

const CF = [{ id: "cfpresupuesto01", label: "Presupuesto", type: "number", options: [] }];

describe("normalización", () => {
  it("email: minúsculas, inválidos detectados", () => {
    expect(normalizeEmail("  Ana@Mail.COM ")).toBe("ana@mail.com");
    expect(normalizeEmail("ana@")).toBe("invalid");
    expect(normalizeEmail("")).toBeNull();
  });
  it("teléfono: conserva + y dígitos, valida largo", () => {
    expect(normalizePhone("+54 9 11 5555-1234")).toBe("+5491155551234");
    expect(normalizePhone("123")).toBe("invalid");
    expect(normalizePhone("  ")).toBeNull();
  });
  it("clave de teléfono: últimos 10 dígitos (prefijos distintos coinciden)", () => {
    expect(phoneMatchKey("+54 9 11 5555-1234")).toBe("1155551234");
    expect(phoneMatchKey("011 5555 1234")).toBe("1155551234");
    expect(phoneMatchKey("1155551234")).toBe("1155551234");
  });
});

describe("mapRow", () => {
  const mapping = { "Nombre y apellido": "name", Correo: "email", WhatsApp: "phone", Consulta: "note", Presupuesto: "cf:cfpresupuesto01", Fecha: "ignore" } as const;

  it("mapea, normaliza y valida campos personalizados", () => {
    const r = mapRow(
      { "Nombre y apellido": " Ana  Pérez ", Correo: "ANA@MAIL.COM", WhatsApp: "11 5555 1234", Consulta: "Quiero info", Presupuesto: "1.500,50", Fecha: "hoy" },
      { ...mapping },
      ["name"],
      CF
    );
    expect(r).toEqual({ ok: true, data: { name: "Ana Pérez", email: "ana@mail.com", phone: "1155551234", note: "Quiero info", custom: { cfpresupuesto01: "1500.5" } } });
  });

  it("rechaza datos obligatorios faltantes y formatos inválidos", () => {
    const r = mapRow({ Correo: "no-es-email", WhatsApp: "12" }, { ...mapping }, ["name", "email"], CF);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain('Falta el dato obligatorio "Nombre"');
      expect(r.errors.some((e) => e.startsWith("Email inválido"))).toBe(true);
      expect(r.errors.some((e) => e.startsWith("Teléfono inválido"))).toBe(true);
    }
  });

  it("una fila sin nombre, email ni teléfono nunca crea lead", () => {
    const r = mapRow({ Consulta: "hola" }, { ...mapping }, [], CF);
    expect(r.ok).toBe(false);
  });

  it("ignora destinos de campos personalizados desconocidos (otro negocio)", () => {
    const r = mapRow({ Correo: "a@b.co", X: "1" }, { Correo: "email", X: "cf:ajeno0000001" }, [], CF);
    expect(r).toMatchObject({ ok: true, data: { custom: {} } });
  });

  it("nombre de respaldo", () => {
    expect(fallbackLeadName({ name: null, email: "a@b.co", phone: null }, "Sheets")).toBe("a@b.co");
    expect(fallbackLeadName({ name: null, email: null, phone: null }, "Sheets")).toBe("Lead de Sheets");
  });
});
