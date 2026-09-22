import { describe, expect, it, vi, beforeEach } from "vitest";

const moduleConfigFindUnique = vi.fn();
const moduleConfigUpsert = vi.fn();
const moduleConfigCreate = vi.fn();
const workspaceFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    moduleConfig: {
      findUnique: (...a: unknown[]) => moduleConfigFindUnique(...a),
      upsert: (...a: unknown[]) => moduleConfigUpsert(...a),
      create: (...a: unknown[]) => moduleConfigCreate(...a),
    },
    workspace: { findUnique: (...a: unknown[]) => workspaceFindUnique(...a) },
  },
}));

const { getModuleLabel, listModuleLabels, updateModuleLabel, seedModuleLabelIfEmpty } = await import("./module-config");

beforeEach(() => {
  for (const m of [moduleConfigFindUnique, moduleConfigUpsert, moduleConfigCreate, workspaceFindUnique]) m.mockReset();
  workspaceFindUnique.mockResolvedValue({ activeModules: ["companies", "contacts", "leads", "opportunities", "tasks"] });
});

describe("getModuleLabel — defaults y personalización (Fase 2/3)", () => {
  it("sin fila propia, devuelve el fallback genérico Oportunidad/Oportunidades", async () => {
    moduleConfigFindUnique.mockResolvedValue(null);
    const label = await getModuleLabel("biz-a", "opportunity");
    expect(label).toMatchObject({ labelSingular: "Oportunidad", labelPlural: "Oportunidades", icon: "trending-up", enabled: true });
  });

  it("con fila propia, devuelve el nombre personalizado por el Workspace", async () => {
    moduleConfigFindUnique.mockResolvedValue({ labelSingular: "Venta", labelPlural: "Ventas", icon: "trending-up" });
    const label = await getModuleLabel("biz-a", "opportunity");
    expect(label.labelSingular).toBe("Venta");
    expect(label.labelPlural).toBe("Ventas");
  });

  it("un ícono guardado que ya no es válido cae al default en vez de romper la UI", async () => {
    moduleConfigFindUnique.mockResolvedValue({ labelSingular: "Caso", labelPlural: "Casos", icon: "un-icono-que-ya-no-existe" });
    const label = await getModuleLabel("biz-a", "opportunity");
    expect(label.icon).toBe("trending-up");
  });

  it("enabled se deriva de Workspace.activeModules, no de un flag propio", async () => {
    workspaceFindUnique.mockResolvedValue({ activeModules: ["companies", "tasks"] }); // sin "opportunities"
    moduleConfigFindUnique.mockResolvedValue(null);
    const label = await getModuleLabel("biz-a", "opportunity");
    expect(label.enabled).toBe(false);
  });

  it("4. Fase 9 — módulo deshabilitado no impide leer su nombre configurado (se puede seguir editando)", async () => {
    workspaceFindUnique.mockResolvedValue({ activeModules: [] });
    moduleConfigFindUnique.mockResolvedValue({ labelSingular: "Caso", labelPlural: "Casos", icon: "target" });
    const label = await getModuleLabel("biz-a", "opportunity");
    expect(label).toMatchObject({ labelPlural: "Casos", enabled: false });
  });

  it("consulta SIEMPRE scopeada al businessId (aislamiento — Fase 7)", async () => {
    moduleConfigFindUnique.mockResolvedValue(null);
    await getModuleLabel("biz-b", "opportunity");
    expect(moduleConfigFindUnique.mock.calls[0][0].where).toEqual({ businessId_internalModule: { businessId: "biz-b", internalModule: "opportunity" } });
    expect(workspaceFindUnique.mock.calls[0][0].where).toEqual({ businessId: "biz-b" });
  });
});

describe("listModuleLabels", () => {
  it("devuelve una entrada por cada módulo interno configurable", async () => {
    moduleConfigFindUnique.mockResolvedValue(null);
    const labels = await listModuleLabels("biz-a");
    expect(labels).toHaveLength(1);
    expect(labels[0].internalModule).toBe("opportunity");
  });
});

describe("updateModuleLabel — aislamiento entre Workspaces (Fase 7)", () => {
  it("el upsert queda acotado al businessId del actor, nunca puede tocar otro Workspace", async () => {
    moduleConfigUpsert.mockResolvedValue({});
    moduleConfigFindUnique.mockResolvedValue({ labelSingular: "Venta", labelPlural: "Ventas", icon: "trending-up" });
    await updateModuleLabel("biz-a", "opportunity", { labelSingular: "Venta", labelPlural: "Ventas", icon: "trending-up" });

    const call = moduleConfigUpsert.mock.calls[0][0];
    expect(call.where).toEqual({ businessId_internalModule: { businessId: "biz-a", internalModule: "opportunity" } });
    expect(call.create.businessId).toBe("biz-a");
  });

  it("dos Workspaces pueden tener nombres distintos para el mismo módulo interno, sin pisarse", async () => {
    moduleConfigUpsert.mockResolvedValue({});
    moduleConfigFindUnique.mockResolvedValueOnce({ labelSingular: "Venta", labelPlural: "Ventas", icon: "trending-up" });
    await updateModuleLabel("biz-a", "opportunity", { labelSingular: "Venta", labelPlural: "Ventas" });
    expect(moduleConfigUpsert.mock.calls[0][0].where.businessId_internalModule.businessId).toBe("biz-a");

    moduleConfigFindUnique.mockResolvedValueOnce({ labelSingular: "Caso", labelPlural: "Casos", icon: "target" });
    await updateModuleLabel("biz-b", "opportunity", { labelSingular: "Caso", labelPlural: "Casos", icon: "target" });
    expect(moduleConfigUpsert.mock.calls[1][0].where.businessId_internalModule.businessId).toBe("biz-b");
  });
});

describe("seedModuleLabelIfEmpty", () => {
  it("crea el label si el Workspace todavía no tiene ninguno propio", async () => {
    moduleConfigFindUnique.mockResolvedValue(null);
    await seedModuleLabelIfEmpty("biz-a", "opportunity", { labelSingular: "Proyecto", labelPlural: "Proyectos", icon: "check-square" });
    expect(moduleConfigCreate).toHaveBeenCalledWith({ data: { businessId: "biz-a", internalModule: "opportunity", labelSingular: "Proyecto", labelPlural: "Proyectos", icon: "check-square" } });
  });

  it("NO pisa un label que el Workspace ya haya personalizado", async () => {
    moduleConfigFindUnique.mockResolvedValue({ id: "existing" });
    await seedModuleLabelIfEmpty("biz-a", "opportunity", { labelSingular: "Proyecto", labelPlural: "Proyectos", icon: "check-square" });
    expect(moduleConfigCreate).not.toHaveBeenCalled();
  });
});
