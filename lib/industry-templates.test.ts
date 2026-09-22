import { describe, expect, it } from "vitest";

import { INDUSTRY_OPTIONS, INDUSTRY_TEMPLATES, type IndustryKey } from "./industry-templates";
import { AVAILABLE_MODULES } from "@/modules/workspace/available-modules";

const KEYS: IndustryKey[] = ["software", "comercio", "servicios", "gimnasio", "inmobiliaria", "construccion", "otro"];

describe("INDUSTRY_TEMPLATES — cada industria (Fase 5)", () => {
  it.each(KEYS)("%s define módulos, nombre de módulo, pipeline y etapas iniciales completos", (key) => {
    const t = INDUSTRY_TEMPLATES[key];
    expect(t.activeModules.length).toBeGreaterThan(0);
    expect(t.activeModules.every((m) => (AVAILABLE_MODULES as readonly string[]).includes(m))).toBe(true);
    expect(t.moduleLabel.labelSingular).toBeTruthy();
    expect(t.moduleLabel.labelPlural).toBeTruthy();
    expect(t.pipelineName).toBeTruthy();
    expect(t.pipelineStages.length).toBeGreaterThan(0);
    expect(t.pipelineStages.some((s) => s.isWon)).toBe(true);
    expect(t.leadStatuses.length).toBeGreaterThan(0);
    expect(t.companyStatuses.length).toBeGreaterThan(0);
  });

  it("las 4 verticales del pedido están presentes: comercio, servicios, construcción, inmobiliaria (+ otro)", () => {
    const keys = Object.keys(INDUSTRY_TEMPLATES);
    expect(keys).toEqual(expect.arrayContaining(["comercio", "servicios", "construccion", "inmobiliaria", "otro"]));
  });

  it("construcción/carpintería sugiere el ejemplo del pedido: Leads, Presupuesto, Producción, Finalizado", () => {
    const t = INDUSTRY_TEMPLATES.construccion;
    expect(t.moduleLabel.labelPlural).toBe("Proyectos");
    expect(t.pipelineStages.map((s) => s.label)).toEqual(["Lead", "Presupuesto", "Producción", "Finalizado", "Cancelado"]);
  });

  it("servicios profesionales sugiere Consultas/Citas/Casos", () => {
    const t = INDUSTRY_TEMPLATES.servicios;
    expect(t.moduleLabel.labelPlural).toBe("Casos");
    expect(t.pipelineStages.map((s) => s.label)).toEqual(["Consulta", "Cita", "Caso abierto", "Cerrado", "Cerrado sin acuerdo"]);
  });

  it("INDUSTRY_OPTIONS tiene una entrada por cada template, sin duplicados", () => {
    expect(INDUSTRY_OPTIONS).toHaveLength(KEYS.length);
    expect(new Set(INDUSTRY_OPTIONS.map((o) => o.value)).size).toBe(KEYS.length);
  });
});
