import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireWorkspace = vi.fn();
vi.mock("@/lib/api-guard", async () => {
  const { parseBody } = await vi.importActual<typeof import("@/lib/api-guard")>("@/lib/api-guard");
  return { requireWorkspace: (...a: unknown[]) => requireWorkspace(...a), parseBody };
});
const deleteRecords = vi.fn();
const getDeletionImpact = vi.fn();
vi.mock("@/modules/records/delete", async () => {
  const actual = await vi.importActual<typeof import("@/modules/records/delete")>("@/modules/records/delete");
  return { ...actual, deleteRecords: (...a: unknown[]) => deleteRecords(...a), getDeletionImpact: (...a: unknown[]) => getDeletionImpact(...a) };
});

const { POST } = await import("./route");
const req = (body: unknown) => new Request("http://x/api/records/delete", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  requireWorkspace.mockResolvedValue({ ctx: { businessId: "biz_A", role: "admin" }, response: null });
});

describe("POST /api/records/delete", () => {
  it("exige rol admin (miembros reciben 403 y no se borra nada)", async () => {
    requireWorkspace.mockResolvedValue({ ctx: null, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) });
    const res = await POST(req({ entityType: "lead", ids: ["l1"] }));
    expect(res.status).toBe(403);
    expect(requireWorkspace).toHaveBeenCalledWith({ minRole: "admin" });
    expect(deleteRecords).not.toHaveBeenCalled();
  });

  it("valida tipo e ids", async () => {
    expect((await POST(req({ entityType: "task", ids: ["t1"] }))).status).toBe(400);
    expect((await POST(req({ entityType: "lead", ids: [] }))).status).toBe(400);
  });

  it("preview no borra", async () => {
    getDeletionImpact.mockResolvedValue({ found: 1, unlinked: [], removed: [] });
    const res = await POST(req({ entityType: "lead", ids: ["l1"], preview: true }));
    expect(await res.json()).toEqual({ found: 1, unlinked: [], removed: [] });
    expect(deleteRecords).not.toHaveBeenCalled();
  });

  it("usa el businessId de la sesión y distingue éxito, parcial y fallo total", async () => {
    deleteRecords.mockResolvedValueOnce({ deleted: ["l1"], notFound: [], failed: [] });
    expect((await POST(req({ entityType: "lead", ids: ["l1"] }))).status).toBe(200);
    expect(deleteRecords).toHaveBeenCalledWith("biz_A", "lead", ["l1"]);

    deleteRecords.mockResolvedValueOnce({ deleted: ["l1"], notFound: [], failed: ["l2"] });
    expect((await POST(req({ entityType: "lead", ids: ["l1", "l2"] }))).status).toBe(207);

    deleteRecords.mockResolvedValueOnce({ deleted: [], notFound: [], failed: ["l2"] });
    expect((await POST(req({ entityType: "lead", ids: ["l2"] }))).status).toBe(500);
  });
});
