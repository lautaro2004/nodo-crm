import { describe, expect, it, vi, beforeEach } from "vitest";

const workspaceFindUnique = vi.fn();
const workspaceCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: {
      findUnique: (...args: unknown[]) => workspaceFindUnique(...args),
      create: (...args: unknown[]) => workspaceCreate(...args),
    },
  },
}));

const { ensureWorkspace, getWorkspace } = await import("./service");

beforeEach(() => {
  workspaceFindUnique.mockReset();
  workspaceCreate.mockReset();
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
