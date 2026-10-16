import { describe, expect, it, vi, beforeEach } from "vitest";

const opportunityCreate = vi.fn();
const opportunityFindFirst = vi.fn();
const opportunityUpdate = vi.fn();
const companyFindFirst = vi.fn();
const contactFindFirst = vi.fn();
const pipelineFindFirst = vi.fn();
const stageFindFirst = vi.fn();
const activityCreate = vi.fn();
const membershipFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    opportunity: {
      create: (...args: unknown[]) => opportunityCreate(...args),
      findFirst: (...args: unknown[]) => opportunityFindFirst(...args),
      update: (...args: unknown[]) => opportunityUpdate(...args),
    },
    company: { findFirst: (...args: unknown[]) => companyFindFirst(...args) },
    contact: { findFirst: (...args: unknown[]) => contactFindFirst(...args) },
    pipeline: { findFirst: (...args: unknown[]) => pipelineFindFirst(...args) },
    pipelineStage: { findFirst: (...args: unknown[]) => stageFindFirst(...args) },
    membership: { findFirst: (...args: unknown[]) => membershipFindFirst(...args) },
  },
}));

vi.mock("@/modules/activities/service", () => ({
  createActivity: (...args: unknown[]) => activityCreate(...args),
}));

const { createOpportunity, updateOpportunity } = await import("./service");

beforeEach(() => {
  opportunityCreate.mockReset();
  opportunityFindFirst.mockReset();
  opportunityUpdate.mockReset();
  companyFindFirst.mockReset();
  contactFindFirst.mockReset();
  pipelineFindFirst.mockReset();
  stageFindFirst.mockReset();
  activityCreate.mockReset();
  membershipFindFirst.mockReset();
  membershipFindFirst.mockResolvedValue({ id: "m_1" });
});

const VALID_INPUT = { title: "Deal", pipelineId: "pipe_1", stageId: "stage_1" };

describe("createOpportunity — pipeline y stage", () => {
  it("rechaza si el pipeline no pertenece al mismo negocio", async () => {
    pipelineFindFirst.mockResolvedValue(null);
    await expect(createOpportunity("biz_1", VALID_INPUT)).rejects.toThrow("pipeline_not_found");
    expect(pipelineFindFirst).toHaveBeenCalledWith({ where: { id: "pipe_1", businessId: "biz_1" }, select: { id: true } });
    expect(opportunityCreate).not.toHaveBeenCalled();
  });

  it("rechaza si la etapa no pertenece (vía pipeline) al mismo negocio", async () => {
    pipelineFindFirst.mockResolvedValue({ id: "pipe_1" });
    stageFindFirst.mockResolvedValue(null);
    await expect(createOpportunity("biz_1", VALID_INPUT)).rejects.toThrow("stage_not_found");
    expect(stageFindFirst).toHaveBeenCalledWith({
      where: { id: "stage_1", pipeline: { businessId: "biz_1" } },
      select: { id: true, pipelineId: true, label: true, isWon: true, isLost: true },
    });
  });

  it("crea la oportunidad cuando pipeline y stage son válidos, y registra Activity", async () => {
    pipelineFindFirst.mockResolvedValue({ id: "pipe_1" });
    stageFindFirst.mockResolvedValue({ id: "stage_1" });
    opportunityCreate.mockResolvedValue({ id: "opp_1" });

    await createOpportunity("biz_1", VALID_INPUT);

    expect(opportunityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ businessId: "biz_1", pipelineId: "pipe_1", stageId: "stage_1" }) })
    );
    expect(activityCreate).toHaveBeenCalledWith("biz_1", expect.objectContaining({ relatedType: "opportunity", relatedId: "opp_1" }));
  });
});

describe("cambio de etapa y estado", () => {
  it("cambiar stageId registra una Activity de tipo stage_change", async () => {
    opportunityFindFirst.mockResolvedValue({ id: "opp_1", stageId: "stage_1", status: "open" });
    stageFindFirst.mockResolvedValue({ id: "stage_2" });
    opportunityUpdate.mockResolvedValue({ id: "opp_1", stageId: "stage_2" });

    await updateOpportunity("biz_1", "opp_1", { stageId: "stage_2" });

    expect(activityCreate).toHaveBeenCalledWith("biz_1", expect.objectContaining({ type: "stage_change" }));
  });

  it("cerrar como 'won' setea closedAt", async () => {
    opportunityFindFirst.mockResolvedValue({ id: "opp_1", stageId: "stage_1", status: "open" });
    opportunityUpdate.mockResolvedValue({ id: "opp_1", status: "won" });

    await updateOpportunity("biz_1", "opp_1", { status: "won" });

    const call = opportunityUpdate.mock.calls[0][0];
    expect(call.data.closedAt).toBeInstanceOf(Date);
  });
});

describe("aislamiento multi-tenant", () => {
  it("updateOpportunity sobre una oportunidad de OTRO negocio devuelve null", async () => {
    opportunityFindFirst.mockResolvedValue(null);
    const result = await updateOpportunity("biz_A", "opp_de_biz_B", { title: "Hackeo" });
    expect(opportunityFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "opp_de_biz_B", businessId: "biz_A" } }));
    expect(result).toBeNull();
  });
});

describe("integridad de etapa y status (server-side)", () => {
  it("rechaza mover a una etapa de OTRO pipeline", async () => {
    opportunityFindFirst.mockResolvedValue({ id: "opp_1", pipelineId: "pipe_1", stageId: "stage_1", status: "open" });
    stageFindFirst.mockResolvedValue({ id: "stage_x", pipelineId: "pipe_2", label: "X", isWon: false, isLost: false });
    await expect(updateOpportunity("biz_1", "opp_1", { stageId: "stage_x" })).rejects.toThrow("stage_not_in_pipeline");
    expect(opportunityUpdate).not.toHaveBeenCalled();
  });

  it("mover a una etapa Ganada setea status won + closedAt y registra 'A → B'", async () => {
    opportunityFindFirst.mockResolvedValue({ id: "opp_1", pipelineId: "pipe_1", stageId: "stage_1", status: "open", stage: { label: "Propuesta" } });
    stageFindFirst.mockResolvedValue({ id: "stage_won", pipelineId: "pipe_1", label: "Ganado", isWon: true, isLost: false });
    opportunityUpdate.mockResolvedValue({ id: "opp_1" });

    await updateOpportunity("biz_1", "opp_1", { stageId: "stage_won" });

    const call = opportunityUpdate.mock.calls[0][0];
    expect(call.data.status).toBe("won");
    expect(call.data.closedAt).toBeInstanceOf(Date);
    expect(activityCreate).toHaveBeenCalledWith("biz_1", expect.objectContaining({ type: "stage_change", body: "Propuesta → Ganado" }));
    expect(activityCreate).toHaveBeenCalledWith("biz_1", expect.objectContaining({ type: "status_change", body: "open → won" }));
  });

  it("volver de Ganado a una etapa normal reabre la oportunidad", async () => {
    opportunityFindFirst.mockResolvedValue({ id: "opp_1", pipelineId: "pipe_1", stageId: "stage_won", status: "won" });
    stageFindFirst.mockResolvedValue({ id: "stage_2", pipelineId: "pipe_1", label: "Negociación", isWon: false, isLost: false });
    opportunityUpdate.mockResolvedValue({ id: "opp_1" });

    await updateOpportunity("biz_1", "opp_1", { stageId: "stage_2" });

    const call = opportunityUpdate.mock.calls[0][0];
    expect(call.data.status).toBe("open");
    expect(call.data.closedAt).toBeNull();
  });

  it("cambiar de pipeline sin etapa es inválido", async () => {
    pipelineFindFirst.mockResolvedValue({ id: "pipe_2" });
    opportunityFindFirst.mockResolvedValue({ id: "opp_1", pipelineId: "pipe_1", stageId: "stage_1", status: "open" });
    await expect(updateOpportunity("biz_1", "opp_1", { pipelineId: "pipe_2" })).rejects.toThrow("stage_required");
  });

  it("rechaza un responsable ajeno al negocio", async () => {
    membershipFindFirst.mockResolvedValue(null);
    await expect(updateOpportunity("biz_1", "opp_1", { ownerId: "intruso" })).rejects.toThrow("user_not_in_business");
  });
});
