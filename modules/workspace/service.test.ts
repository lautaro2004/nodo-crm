import { describe, expect, it, vi, beforeEach } from "vitest";

const workspaceFindUnique = vi.fn();
const workspaceCreate = vi.fn();
const workspaceUpdate = vi.fn();
const pipelineCount = vi.fn();
const pipelineCreate = vi.fn();
const pipelineStageCreateMany = vi.fn();
const statusDefinitionCount = vi.fn();
const statusDefinitionCreateMany = vi.fn();
const moduleConfigFindUnique = vi.fn();
const moduleConfigCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: {
      findUnique: (...args: unknown[]) => workspaceFindUnique(...args),
      create: (...args: unknown[]) => workspaceCreate(...args),
      update: (...args: unknown[]) => workspaceUpdate(...args),
    },
    pipeline: {
      count: (...args: unknown[]) => pipelineCount(...args),
      create: (...args: unknown[]) => pipelineCreate(...args),
    },
    pipelineStage: { createMany: (...args: unknown[]) => pipelineStageCreateMany(...args) },
    statusDefinition: {
      count: (...args: unknown[]) => statusDefinitionCount(...args),
      createMany: (...args: unknown[]) => statusDefinitionCreateMany(...args),
    },
    moduleConfig: {
      findUnique: (...args: unknown[]) => moduleConfigFindUnique(...args),
      create: (...args: unknown[]) => moduleConfigCreate(...args),
    },
  },
}));

const { ensureWorkspace, getWorkspace, applyIndustryTemplate, updateWorkspaceModules } = await import("./service");

beforeEach(() => {
  for (const m of [
    workspaceFindUnique, workspaceCreate, workspaceUpdate,
    pipelineCount, pipelineCreate, pipelineStageCreateMany,
    statusDefinitionCount, statusDefinitionCreateMany,
    moduleConfigFindUnique, moduleConfigCreate,
  ])
    m.mockReset();
  workspaceUpdate.mockResolvedValue({});
  pipelineCreate.mockResolvedValue({ id: "pipe1" });
  moduleConfigFindUnique.mockResolvedValue(null);
});

describe("ensureWorkspace", () => {
  it("si ya existe un Workspace para ese businessId, lo devuelve sin crear uno nuevo", async () => {
    const existing = { businessId: "biz_1", activeModules: ["companies"] };
    workspaceFindUnique.mockResolvedValue(existing);

    const result = await ensureWorkspace("biz_1");

    expect(result).toBe(existing);
    expect(workspaceCreate).not.toHaveBeenCalled();
  });

  it("si no existe, crea uno con los módulos default y onboardingStep inicial", async () => {
    workspaceFindUnique.mockResolvedValue(null);
    workspaceCreate.mockResolvedValue({ businessId: "biz_2" });

    await ensureWorkspace("biz_2");

    expect(workspaceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: "biz_2",
          onboardingStep: "industry",
          activeModules: expect.arrayContaining(["companies", "contacts", "leads"]),
        }),
      })
    );
  });
});

describe("getWorkspace", () => {
  it("busca por businessId, nunca por otro campo (aislamiento multi-tenant)", async () => {
    workspaceFindUnique.mockResolvedValue(null);

    await getWorkspace("biz_3");

    expect(workspaceFindUnique).toHaveBeenCalledWith({ where: { businessId: "biz_3" } });
  });
});

describe("applyIndustryTemplate — Fase 4/6 (pipelines y nombre del módulo por rubro)", () => {
  it("crea el pipeline con el nombre del template (no 'Ventas' fijo) y siembra sus etapas", async () => {
    pipelineCount.mockResolvedValue(0);
    statusDefinitionCount.mockResolvedValue(0);

    await applyIndustryTemplate("biz-a", "servicios");

    expect(pipelineCreate.mock.calls[0][0].data).toMatchObject({ businessId: "biz-a", name: "Casos", isDefault: true });
    expect(pipelineStageCreateMany.mock.calls[0][0].data[0]).toMatchObject({ pipelineId: "pipe1", key: "consulta", label: "Consulta" });
  });

  it("siembra el nombre del módulo (moduleLabel) del template, scopeado al Workspace", async () => {
    pipelineCount.mockResolvedValue(0);
    statusDefinitionCount.mockResolvedValue(0);

    await applyIndustryTemplate("biz-a", "construccion");

    expect(moduleConfigFindUnique.mock.calls[0][0].where).toEqual({ businessId_internalModule: { businessId: "biz-a", internalModule: "opportunity" } });
    expect(moduleConfigCreate.mock.calls[0][0].data).toMatchObject({
      businessId: "biz-a",
      internalModule: "opportunity",
      labelSingular: "Proyecto",
      labelPlural: "Proyectos",
    });
  });

  it("NO pisa un pipeline, estados o nombre de módulo que el Workspace ya tenga propios", async () => {
    pipelineCount.mockResolvedValue(1);
    statusDefinitionCount.mockResolvedValue(1);
    moduleConfigFindUnique.mockResolvedValue({ id: "existing", labelSingular: "Venta ya personalizada" });

    await applyIndustryTemplate("biz-a", "inmobiliaria");

    expect(pipelineCreate).not.toHaveBeenCalled();
    expect(statusDefinitionCreateMany).not.toHaveBeenCalled();
    expect(moduleConfigCreate).not.toHaveBeenCalled();
  });

  it("distintos Workspaces obtienen distintos nombres de módulo según SU rubro (aislamiento de configuración)", async () => {
    pipelineCount.mockResolvedValue(0);
    statusDefinitionCount.mockResolvedValue(0);

    await applyIndustryTemplate("biz-a", "servicios");
    const aLabel = moduleConfigCreate.mock.calls[0][0].data.labelPlural;

    moduleConfigCreate.mockClear();
    await applyIndustryTemplate("biz-b", "inmobiliaria");
    const bLabel = moduleConfigCreate.mock.calls[0][0].data.labelPlural;

    expect(aLabel).toBe("Casos");
    expect(bLabel).toBe("Operaciones");
    expect(moduleConfigCreate.mock.calls[0][0].data.businessId).toBe("biz-b");
  });
});

describe("applyIndustryTemplate — selección de módulos del onboarding (paso 2)", () => {
  it("módulos seleccionados: usa la selección editada por el usuario, no la sugerida por el template tal cual", async () => {
    pipelineCount.mockResolvedValue(0);
    statusDefinitionCount.mockResolvedValue(0);

    // "construccion" sugiere las 5, el usuario destildó "opportunities".
    await applyIndustryTemplate("biz-a", "construccion", ["companies", "contacts", "leads", "tasks"]);

    expect(workspaceUpdate.mock.calls[0][0].data.activeModules).toEqual(["companies", "contacts", "leads", "tasks"]);
  });

  it("sin selección explícita, cae en los módulos sugeridos por el template (comportamiento previo intacto)", async () => {
    pipelineCount.mockResolvedValue(0);
    statusDefinitionCount.mockResolvedValue(0);

    await applyIndustryTemplate("biz-a", "gimnasio");

    expect(workspaceUpdate.mock.calls[0][0].data.activeModules).toEqual(INDUSTRY_TEMPLATE_GIMNASIO_MODULES);
  });

  it("configuración creada: siembra el pipeline y el nombre del módulo AUNQUE el usuario haya destildado ese módulo — no es irreversible", async () => {
    pipelineCount.mockResolvedValue(0);
    statusDefinitionCount.mockResolvedValue(0);

    await applyIndustryTemplate("biz-a", "servicios", ["companies", "contacts", "leads", "tasks"]); // sin "opportunities"

    expect(pipelineCreate).toHaveBeenCalled(); // el pipeline "Casos" se siembra igual
    expect(moduleConfigCreate).toHaveBeenCalled(); // el nombre "Casos" queda listo para cuando se reactive
    expect(workspaceUpdate.mock.calls[0][0].data.activeModules).not.toContain("opportunities");
  });

  it("usuario que saltea el onboarding: sin industry, no se aplica ningún template ni se tocan módulos (simulado a nivel de ruta)", async () => {
    // El equivalente de "saltear" es no llamar a applyIndustryTemplate — la
    // propia ruta (app/api/onboarding/route.ts) sólo la invoca si viene
    // `industry`. Acá se prueba que ensureWorkspace por sí sola deja un
    // Workspace usable con los módulos default, sin pipeline ni nombre de
    // módulo custom.
    workspaceFindUnique.mockResolvedValue(null);
    workspaceCreate.mockResolvedValue({ businessId: "biz-skip", activeModules: ["companies", "contacts", "leads", "opportunities", "tasks"] });

    const ws = await ensureWorkspace("biz-skip");

    expect(ws.activeModules).toEqual(["companies", "contacts", "leads", "opportunities", "tasks"]);
    expect(pipelineCreate).not.toHaveBeenCalled();
    expect(moduleConfigCreate).not.toHaveBeenCalled();
  });
});

const INDUSTRY_TEMPLATE_GIMNASIO_MODULES = ["companies", "contacts", "leads", "tasks"];

describe("updateWorkspaceModules — editar después del onboarding (Fase 4)", () => {
  it("actualiza activeModules del Workspace indicado", async () => {
    workspaceUpdate.mockResolvedValue({ businessId: "biz-a", activeModules: ["tasks"] });
    await updateWorkspaceModules("biz-a", ["tasks"]);
    expect(workspaceUpdate).toHaveBeenCalledWith({ where: { businessId: "biz-a" }, data: { activeModules: ["tasks"] } });
  });

  it("usuario que vuelve a editar: puede reactivar un módulo que el onboarding había dejado apagado", async () => {
    workspaceUpdate.mockResolvedValue({});
    await updateWorkspaceModules("biz-a", ["companies", "contacts", "leads", "tasks"]); // onboarding: sin opportunities
    await updateWorkspaceModules("biz-a", ["companies", "contacts", "leads", "opportunities", "tasks"]); // edición posterior: lo reactiva

    expect(workspaceUpdate).toHaveBeenLastCalledWith({
      where: { businessId: "biz-a" },
      data: { activeModules: ["companies", "contacts", "leads", "opportunities", "tasks"] },
    });
  });

  it("aislamiento: editar los módulos de un Workspace nunca toca el where de otro", async () => {
    workspaceUpdate.mockResolvedValue({});
    await updateWorkspaceModules("biz-a", ["tasks"]);
    await updateWorkspaceModules("biz-b", ["companies"]);

    expect(workspaceUpdate.mock.calls[0][0].where).toEqual({ businessId: "biz-a" });
    expect(workspaceUpdate.mock.calls[1][0].where).toEqual({ businessId: "biz-b" });
  });
});
