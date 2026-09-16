import { describe, expect, it, vi, beforeEach } from "vitest";

const opportunityCreate = vi.fn();
const opportunityFindFirst = vi.fn();
const opportunityUpdate = vi.fn();
const companyFindFirst = vi.fn();
const contactFindFirst = vi.fn();
const pipelineFindFirst = vi.fn();
const stageFindFirst = vi.fn();
const activityCreate = vi.fn();

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
      select: { id: true },
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
    expect(opportunityFindFirst).toHaveBeenCalledWith({ where: { id: "opp_de_biz_B", businessId: "biz_A" } });
    expect(result).toBeNull();
  });
});
