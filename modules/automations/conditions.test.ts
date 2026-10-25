import { describe, expect, it } from "vitest";

import type { FieldMeta } from "@/lib/entities";
import { evaluateCondition, evaluateGroup, validateCondition } from "./conditions";

const status: FieldMeta = { key: "status", label: "Estado", type: "select", options: [{ value: "new", label: "Nuevo" }, { value: "rechazado", label: "Rechazado" }], writable: true };
const amount: FieldMeta = { key: "amount", label: "Valor", type: "currency", writable: true };
const tags: FieldMeta = { key: "cf:1", label: "Rubros", type: "multiselect", options: [{ value: "A", label: "A" }], writable: true };
const date: FieldMeta = { key: "createdAt", label: "Creado", type: "datetime", writable: false };
const fields = new Map([status, amount, tags, date].map((f) => [f.key, f]));

describe("condiciones de automatizaciones", () => {
  it("«cambió a» detecta la transición y no se dispara si ya estaba en ese estado", () => {
    const c = { field: "status", op: "changed_to", value: "rechazado" };
    expect(evaluateCondition(c, status, { status: "rechazado" }, { status: "new" })).toBe(true);
    expect(evaluateCondition(c, status, { status: "rechazado" }, { status: "rechazado" })).toBe(false);
    // Alta: «cambió a X» = «es X».
    expect(evaluateCondition(c, status, { status: "rechazado" }, null)).toBe(true);
  });

  it("números en formato es-AR y comparaciones", () => {
    expect(evaluateCondition({ field: "amount", op: "gte", value: "1.000" }, amount, { amount: "1500" }, null)).toBe(true);
    expect(evaluateCondition({ field: "amount", op: "lt", value: "1000" }, amount, { amount: "1500" }, null)).toBe(false);
  });

  it("listas múltiples: contiene", () => {
    expect(evaluateCondition({ field: "cf:1", op: "contains", value: "A" }, tags, { "cf:1": ["A", "B"] }, null)).toBe(true);
    expect(evaluateCondition({ field: "cf:1", op: "is_empty" }, tags, { "cf:1": [] }, null)).toBe(true);
  });

  it("fechas relativas", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    expect(evaluateCondition({ field: "createdAt", op: "within_last_days", value: "3" }, date, { createdAt: "2026-10-24T10:00:00Z" }, null, now)).toBe(true);
    expect(evaluateCondition({ field: "createdAt", op: "older_than_days", value: "3" }, date, { createdAt: "2026-10-24T10:00:00Z" }, null, now)).toBe(false);
  });

  it("grupos Y/O anidados", () => {
    const group = {
      match: "all" as const,
      conditions: [
        { field: "status", op: "equals", value: "rechazado" },
        { match: "any" as const, conditions: [{ field: "amount", op: "gt", value: "100" }, { field: "cf:1", op: "contains", value: "A" }] },
      ],
    };
    expect(evaluateGroup(group, fields, { status: "rechazado", amount: "50", "cf:1": ["A"] }, null)).toBe(true);
    expect(evaluateGroup(group, fields, { status: "rechazado", amount: "50", "cf:1": [] }, null)).toBe(false);
  });

  it("un campo borrado nunca cumple (no dispara de más)", () => {
    expect(evaluateCondition({ field: "cf:borrado", op: "is_empty" }, undefined, {}, null)).toBe(false);
  });

  it("valida operador y valor según el tipo", () => {
    expect(validateCondition({ field: "amount", op: "contains", value: "x" }, amount, { allowChangeOps: true })).toMatch(/operador/);
    expect(validateCondition({ field: "amount", op: "gt", value: "abc" }, amount, { allowChangeOps: true })).toMatch(/número/);
    expect(validateCondition({ field: "status", op: "equals", value: "inexistente" }, status, { allowChangeOps: true })).toMatch(/opción/);
    expect(validateCondition({ field: "status", op: "changed_to", value: "new" }, status, { allowChangeOps: false })).toMatch(/modificar/);
    expect(validateCondition({ field: "status", op: "equals", value: "new" }, status, { allowChangeOps: false })).toBeNull();
  });
});
