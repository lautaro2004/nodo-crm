import { describe, expect, it, vi, beforeEach } from "vitest";

// Motor de automatizaciones y campos personalizados: fuera de alcance de
// este test (tienen sus propios tests); se reemplazan por pasamanos.
vi.mock("@/modules/automations/workflow", () => ({
  trackChange: (_input: unknown, write: () => unknown) => write(),
  proposedFrom: () => ({}),
  emitCreated: vi.fn(),
  AutomationRequirementError: class extends Error {},
}));
vi.mock("@/modules/custom-fields/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/custom-fields/service")>()),
  prepareCustomValues: async () => async () => {},
}));

const leadCreate = vi.fn();
const leadFindFirst = vi.fn();
const leadUpdate = vi.fn();
const leadDeleteMany = vi.fn();
const companyFindFirst = vi.fn();
const activityCreate = vi.fn();
const statusDefFindFirst = vi.fn();
const membershipFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      create: (...args: unknown[]) => leadCreate(...args),
      findFirst: (...args: unknown[]) => leadFindFirst(...args),
      update: (...args: unknown[]) => leadUpdate(...args),
      deleteMany: (...args: unknown[]) => leadDeleteMany(...args),
    },
    company: { findFirst: (...args: unknown[]) => companyFindFirst(...args) },
    statusDefinition: { findFirst: (...args: unknown[]) => statusDefFindFirst(...args) },
    membership: { findFirst: (...args: unknown[]) => membershipFindFirst(...args) },
  },
}));

vi.mock("@/modules/automations/engine", () => ({
  runLeadCreatedAutomations: vi.fn(),
  runLeadStatusAutomations: vi.fn(),
}));

vi.mock("@/modules/activities/service", () => ({
  createActivity: (...args: unknown[]) => activityCreate(...args),
}));

const { createLead, updateLead, deleteLead } = await import("./service");

beforeEach(() => {
  leadCreate.mockReset();
  leadFindFirst.mockReset();
  leadUpdate.mockReset();
  leadDeleteMany.mockReset();
  companyFindFirst.mockReset();
  activityCreate.mockReset();
  statusDefFindFirst.mockReset();
  membershipFindFirst.mockReset();
  statusDefFindFirst.mockResolvedValue({ id: "sd_1" });
  membershipFindFirst.mockResolvedValue({ id: "m_1" });
});

describe("createLead", () => {
  it("crea el lead con status 'new' por default y registra una Activity", async () => {
    leadCreate.mockResolvedValue({ id: "lead_1" });
    await createLead("biz_1", { name: "Prospecto" });
    expect(leadCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ businessId: "biz_1", status: "new" }) }));
    expect(activityCreate).toHaveBeenCalledWith("biz_1", expect.objectContaining({ relatedType: "lead", relatedId: "lead_1" }));
  });
});

describe("cambio de estado", () => {
  it("actualizar el status distinto del actual registra una Activity de tipo status_change", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead_1", status: "new" });
    leadUpdate.mockResolvedValue({ id: "lead_1", status: "qualified" });

    await updateLead("biz_1", "lead_1", { status: "qualified" });

    expect(activityCreate).toHaveBeenCalledWith(
      "biz_1",
      expect.objectContaining({ relatedType: "lead", type: "status_change", body: "new → qualified" })
    );
  });

  it("si el status enviado es igual al actual, NO registra una Activity nueva", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead_1", status: "new" });
    leadUpdate.mockResolvedValue({ id: "lead_1", status: "new" });

    await updateLead("biz_1", "lead_1", { status: "new" });

    expect(activityCreate).not.toHaveBeenCalled();
  });
});

describe("aislamiento multi-tenant", () => {
  it("updateLead sobre un lead de OTRO negocio devuelve null (findFirst scopeado no lo encuentra)", async () => {
    leadFindFirst.mockResolvedValue(null);
    const result = await updateLead("biz_A", "lead_de_biz_B", { status: "qualified" });
    expect(leadFindFirst).toHaveBeenCalledWith({ where: { id: "lead_de_biz_B", businessId: "biz_A" } });
    expect(result).toBeNull();
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("deleteLead usa deleteMany con businessId en el where", async () => {
    leadDeleteMany.mockResolvedValue({ count: 0 });
    const ok = await deleteLead("biz_A", "lead_de_biz_B");
    expect(leadDeleteMany).toHaveBeenCalledWith({ where: { id: "lead_de_biz_B", businessId: "biz_A" } });
    expect(ok).toBe(false);
  });
});

describe("validaciones de integridad", () => {
  it("rechaza un status que no existe en la configuración del Workspace", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead_1", status: "new" });
    statusDefFindFirst.mockResolvedValue(null);
    await expect(updateLead("biz_1", "lead_1", { status: "inventado" })).rejects.toThrow("invalid_status");
    expect(statusDefFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: "biz_1", entityType: "lead", key: "inventado" } }));
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("'new' siempre es válido aunque no esté configurado (default + sync de Nexo)", async () => {
    statusDefFindFirst.mockResolvedValue(null);
    leadCreate.mockResolvedValue({ id: "lead_1" });
    await createLead("biz_1", { name: "X", status: "new" });
    expect(leadCreate).toHaveBeenCalled();
  });

  it("rechaza un responsable que no es miembro del negocio", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead_1", status: "new" });
    membershipFindFirst.mockResolvedValue(null);
    await expect(updateLead("biz_1", "lead_1", { ownerId: "user_de_otro_negocio" })).rejects.toThrow("user_not_in_business");
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("no permite crear un lead directamente como 'converted'", async () => {
    await expect(createLead("biz_1", { name: "X", status: "converted" })).rejects.toThrow("use_convert_endpoint");
  });
});

describe("motivo obligatorio en transiciones", () => {
  it("rechaza pasar a un estado que exige motivo sin indicarlo (aplica igual desde Kanban o API)", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead_1", status: "contacted" });
    statusDefFindFirst.mockResolvedValue({ label: "Descartado", requiresReason: true, reasonOptions: [], isRejection: true });
    await expect(updateLead("biz_1", "lead_1", { status: "disqualified" })).rejects.toThrow("reason_required");
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("valida el motivo contra las opciones configuradas", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead_1", status: "contacted" });
    statusDefFindFirst.mockResolvedValue({ label: "Descartado", requiresReason: true, reasonOptions: ["Precio", "Sin respuesta"], isRejection: true });
    await expect(updateLead("biz_1", "lead_1", { status: "disqualified", statusReason: "Otro" })).rejects.toThrow("invalid_reason");
  });

  it("guarda el motivo, lo registra en el historial con el actor y dispara las reglas", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead_1", status: "contacted" });
    statusDefFindFirst.mockResolvedValue({ label: "Descartado", requiresReason: true, reasonOptions: ["Precio"], isRejection: true });
    leadUpdate.mockResolvedValue({ id: "lead_1" });
    activityCreate.mockResolvedValue({ id: "act_9" });
    await updateLead("biz_1", "lead_1", { status: "disqualified", statusReason: "Precio" }, "user_1");
    expect(leadUpdate).toHaveBeenCalledWith({ where: { id: "lead_1" }, data: { status: "disqualified", statusReason: "Precio" } });
    expect(activityCreate).toHaveBeenCalledWith("biz_1", expect.objectContaining({ type: "status_change", body: "contacted → disqualified · Motivo: Precio", ownerId: "user_1" }));
    const { runLeadStatusAutomations } = await import("@/modules/automations/engine");
    expect(runLeadStatusAutomations).toHaveBeenCalledWith("biz_1", { leadId: "lead_1", from: "contacted", to: "disqualified", eventId: "act_9" });
  });

  it("al salir de un estado con motivo, el motivo se limpia", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead_1", status: "disqualified" });
    statusDefFindFirst.mockResolvedValue({ label: "Contactado", requiresReason: false, reasonOptions: [], isRejection: false });
    leadUpdate.mockResolvedValue({ id: "lead_1" });
    await updateLead("biz_1", "lead_1", { status: "contacted" });
    expect(leadUpdate).toHaveBeenCalledWith({ where: { id: "lead_1" }, data: { status: "contacted", statusReason: null } });
  });
});
