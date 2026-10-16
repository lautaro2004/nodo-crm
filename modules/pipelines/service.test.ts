import { describe, expect, it, vi, beforeEach } from "vitest";

const pipelineFindFirst = vi.fn();
const stageCount = vi.fn();
const stageUpdateMany = vi.fn((args: unknown) => args);
const transaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pipeline: { findFirst: (...args: unknown[]) => pipelineFindFirst(...args) },
    pipelineStage: {
      count: (...args: unknown[]) => stageCount(...args),
      updateMany: (args: unknown) => stageUpdateMany(args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

const { reorderStages } = await import("./service");

beforeEach(() => {
  pipelineFindFirst.mockReset();
  stageCount.mockReset();
  stageUpdateMany.mockClear();
  transaction.mockReset();
});

describe("reorderStages — aislamiento", () => {
  it("rechaza si algún id no pertenece al pipeline (ej. etapa de otro negocio)", async () => {
    pipelineFindFirst.mockResolvedValue({ id: "pipe_1" });
    stageCount.mockResolvedValue(1);
    await expect(reorderStages("biz_1", "pipe_1", ["s1", "s_ajena"])).rejects.toThrow("stage_not_found");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("cada update va scopeado por pipelineId", async () => {
    pipelineFindFirst.mockResolvedValue({ id: "pipe_1" });
    stageCount.mockResolvedValue(2);
    await reorderStages("biz_1", "pipe_1", ["s2", "s1"]);
    expect(stageUpdateMany).toHaveBeenCalledWith({ where: { id: "s2", pipelineId: "pipe_1" }, data: { order: 0 } });
    expect(stageUpdateMany).toHaveBeenCalledWith({ where: { id: "s1", pipelineId: "pipe_1" }, data: { order: 1 } });
  });
});
