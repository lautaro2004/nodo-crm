import { describe, expect, it } from "vitest";

import {
  IMPORT_MODULE_DEFS,
  applyMapping,
  guessColumnType,
  slugifyKey,
  suggestStandardField,
  validateCustomValue,
  validateStandardValue,
  type ColumnMapping,
} from "./shared";

describe("suggestStandardField (Fase 2 — detección automática)", () => {
  it('detecta "Teléfono" -> phone, "Email" -> email, "Nombre" -> name', () => {
    const contact = IMPORT_MODULE_DEFS.contact;
    expect(suggestStandardField("Teléfono", contact)).toBe("phone");
    expect(suggestStandardField("Email", contact)).toBe("email");
    expect(suggestStandardField("Nombre", contact)).toBe("name");
    expect(suggestStandardField("Cliente", contact)).toBe("name");
  });

  it("no sugiere nada para una columna sin sinónimo conocido", () => {
    expect(suggestStandardField("Seña", IMPORT_MODULE_DEFS.contact)).toBeNull();
    expect(suggestStandardField("Domicilio", IMPORT_MODULE_DEFS.contact)).toBeNull();
  });
});

describe("guessColumnType (Fase 4 — sugerencia de tipo)", () => {
  it("detecta number, boolean, date y text", () => {
    expect(guessColumnType(["100", "250.50", "30"])).toBe("number");
    expect(guessColumnType(["si", "no", "Sí"])).toBe("boolean");
    expect(guessColumnType(["01/09/2026", "15/09/2026"])).toBe("date");
    expect(guessColumnType(["Calle Falsa 123", "Av. Siempre Viva"])).toBe("text");
  });

  it("una sola columna mixta no fuerza un tipo incorrecto", () => {
    expect(guessColumnType(["100", "no es un número"])).toBe("text");
  });
});

describe("slugifyKey", () => {
  it("normaliza acentos y espacios a snake_case", () => {
    expect(slugifyKey("Seña")).toBe("sena");
    expect(slugifyKey("Fecha de Nacimiento")).toBe("fecha_de_nacimiento");
  });
});

describe("validateStandardValue / validateCustomValue", () => {
  const nameField = IMPORT_MODULE_DEFS.contact.standardFields[0];
  const emailField = IMPORT_MODULE_DEFS.contact.standardFields[1];

  it("un campo requerido vacío es error; uno opcional vacío no", () => {
    expect(validateStandardValue(nameField, "")).toMatch(/Falta/);
    expect(validateStandardValue(emailField, "")).toBeNull();
  });

  it("email inválido es error", () => {
    expect(validateStandardValue(emailField, "no-es-email")).toMatch(/válido/);
    expect(validateStandardValue(emailField, "ok@x.com")).toBeNull();
  });

  it("tipos de custom fields: number/currency, boolean, date, select, multiselect", () => {
    expect(validateCustomValue({ type: "number", options: [], label: "Seña" }, "abc")).toMatch(/número/);
    expect(validateCustomValue({ type: "currency", options: [], label: "Seña" }, "1500")).toBeNull();
    expect(validateCustomValue({ type: "boolean", options: [], label: "Activo" }, "tal vez")).toMatch(/sí\/no/);
    expect(validateCustomValue({ type: "boolean", options: [], label: "Activo" }, "si")).toBeNull();
    expect(validateCustomValue({ type: "date", options: [], label: "Ingreso" }, "no-es-fecha")).toMatch(/fecha/);
    expect(validateCustomValue({ type: "date", options: [], label: "Ingreso" }, "2026-09-20")).toBeNull();
    expect(validateCustomValue({ type: "select", options: ["a", "b"], label: "Plan" }, "c")).toMatch(/opciones/);
    expect(validateCustomValue({ type: "select", options: ["a", "b"], label: "Plan" }, "a")).toBeNull();
    expect(validateCustomValue({ type: "multiselect", options: ["a", "b"], label: "Tags" }, "a, c")).toMatch(/opciones/);
    expect(validateCustomValue({ type: "multiselect", options: ["a", "b"], label: "Tags" }, "a, b")).toBeNull();
  });
});

describe("applyMapping (Fase 3 — mapeo columna -> campo)", () => {
  const moduleDef = IMPORT_MODULE_DEFS.contact;
  const senaDefId = "def-sena";
  const customLabels = new Map([[senaDefId, "Seña"]]);

  const mapping: ColumnMapping[] = [
    { column: "Cliente", target: { kind: "standard", fieldKey: "name" } },
    { column: "Teléfono", target: { kind: "standard", fieldKey: "phone" } },
    { column: "Domicilio", target: { kind: "ignore" } },
    { column: "Seña", target: { kind: "custom", definitionId: senaDefId, fieldType: "currency", options: [] } },
  ];

  it("mapea columnas estándar y personalizadas, e ignora la marcada como ignorar", () => {
    const row = { Cliente: "Juan Pérez", Teléfono: "1122334455", Domicilio: "Calle Falsa 123", Seña: "1500" };
    const result = applyMapping(row, mapping, moduleDef, customLabels);
    expect(result.standard).toEqual({ name: "Juan Pérez", phone: "1122334455" });
    expect(result.custom).toEqual({ [senaDefId]: "1500" });
    expect(result.errors).toEqual([]);
  });

  it("columna ignorada nunca aparece en el resultado aunque tenga datos", () => {
    const row = { Cliente: "Juan", Teléfono: "", Domicilio: "esto se descarta", Seña: "" };
    const result = applyMapping(row, mapping, moduleDef, customLabels);
    expect(result.standard).not.toHaveProperty("domicilio");
    expect(Object.values(result.standard)).not.toContain("esto se descarta");
  });

  it("fila con el campo requerido vacío queda con error", () => {
    const row = { Cliente: "", Teléfono: "123", Domicilio: "", Seña: "" };
    const result = applyMapping(row, mapping, moduleDef, customLabels);
    expect(result.errors.some((e) => e.includes("Nombre"))).toBe(true);
  });

  it("un valor de custom field con tipo inválido queda reportado como error, no se guarda silenciosamente", () => {
    const row = { Cliente: "Juan", Teléfono: "123", Domicilio: "", Seña: "no-es-plata" };
    const result = applyMapping(row, mapping, moduleDef, customLabels);
    expect(result.errors.some((e) => e.includes("Seña"))).toBe(true);
    expect(result.custom).not.toHaveProperty(senaDefId);
  });
});
