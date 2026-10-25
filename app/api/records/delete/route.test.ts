import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import { OWNER_POLICY, SYSTEM_ROLES } from "@/lib/access";

const requireWorkspace = vi.fn();
vi.mock("@/lib/api-guard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-guard")>("@/lib/api-guard");
  return { requireWorkspace: (...a: unknown[]) => requireWorkspace(...a), parseBody: actual.parseBody, forbidden: actual.forbidden };
});
const deleteRecords = vi.fn();
const getDeletionImpact = vi.fn();
vi.mock("@/modules/records/delete", async () => {
  const actual = await vi.importActual<typeof import("@/modules/records/delete")>("@/modules/records/delete");
  return { ...actual, deleteRecords: (...a: unknown[]) => deleteRecords(...a), getDeletionImpact: (...a: unknown[]) => getDeletionImpact(...a) };
});
const loadRecordOwnership = vi.fn();
vi.mock("@/modules/access/ownership", () => ({ loadRecordOwnership: (...a: unknown[]) => loadRecordOwnership(...a) }));

const { POST } = await import("./route");
const req = (body: unknown) => new Request("http://x/api/records/delete", { method: "POST", body: JSON.stringify(body) });

const admin = { businessId: "biz_A", userId: "u_admin", role: "admin", access: { userId: "u_admin", businessId: "biz_A", isOwner: false, roleKey: "admin", roleName: "Admin", policy: OWNER_POLICY, teamUserIds: ["u_admin"] } };
const member = { ...admin, userId: "u_m", role: "member", access: { ...admin.access, userId: "u_m", policy: SYSTEM_ROLES.member.policy, teamUserIds: ["u_m"] } };

beforeEach(() => {
  vi.clearAllMocks();
  requireWorkspace.mockResolvedValue({ ctx: admin, response: null });
  loadRecordOwnership.mockResolvedValue({ ownerId: null });
});

describe("POST /api/records/delete", () => {
  it("sin el permiso «Eliminar» del módulo responde 403 y no borra nada (también por API directa)", async () => {
    requireWorkspace.mockResolvedValue({ ctx: member, response: null });
    const res = await POST(req({ entityType: "lead", ids: ["l1"] }));
    expect(res.status).toBe(403);
    expect(deleteRecords).not.toHaveBeenCalled();
  });

  it("sin sesión/negocio devuelve la respuesta de requireWorkspace", async () => {
    requireWorkspace.mockResolvedValue({ ctx: null, response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) });
    expect((await POST(req({ entityType: "lead", ids: ["l1"] }))).status).toBe(401);
  });

  it("un vendedor con excepción para eliminar leads sí puede (sin cambiar su rol)", async () => {
    const withException = { ...member, access: { ...member.access, policy: { ...member.access.policy, modules: { ...member.access.policy.modules, lead: { ...member.access.policy.modules["*"], delete: true } } } } };
    requireWorkspace.mockResolvedValue({ ctx: withException, response: null });
    deleteRecords.mockResolvedValue({ deleted: ["l1"], notFound: [], failed: [] });
    expect((await POST(req({ entityType: "lead", ids: ["l1"] }))).status).toBe(200);
  });

  it("alcance «propios»: los ids de otros responsables se informan como no encontrados", async () => {
    const own = { ...admin, access: { ...admin.access, policy: { ...OWNER_POLICY, modules: { "*": { ...OWNER_POLICY.modules["*"], scope: "own" as const } } } } };
    requireWorkspace.mockResolvedValue({ ctx: own, response: null });
    loadRecordOwnership.mockImplementation(async (_b: string, _t: string, id: string) => ({ ownerId: id === "mine" ? "u_admin" : "otro" }));
    deleteRecords.mockResolvedValue({ deleted: ["mine"], notFound: [], failed: [] });
    const res = await POST(req({ entityType: "lead", ids: ["mine", "ajeno"] }));
    expect(deleteRecords).toHaveBeenCalledWith("biz_A", "lead", ["mine"], "u_admin");
    expect((await res.json()).notFound).toEqual(["ajeno"]);
  });

  it("valida tipo e ids", async () => {
    expect((await POST(req({ entityType: "nada", ids: ["t1"] }))).status).toBe(400);
    expect((await POST(req({ entityType: "lead", ids: [] }))).status).toBe(400);
  });

  it("preview no borra", async () => {
    getDeletionImpact.mockResolvedValue({ found: 1, unlinked: [], removed: [] });
    const res = await POST(req({ entityType: "lead", ids: ["l1"], preview: true }));
    expect(res.status).toBe(200);
    expect(deleteRecords).not.toHaveBeenCalled();
  });

  it("usa el businessId de la sesión y distingue éxito, parcial y fallo total", async () => {
    deleteRecords.mockResolvedValueOnce({ deleted: ["a"], notFound: [], failed: [] });
    expect((await POST(req({ entityType: "lead", ids: ["a"] }))).status).toBe(200);
    expect(deleteRecords).toHaveBeenCalledWith("biz_A", "lead", ["a"], "u_admin");
    deleteRecords.mockResolvedValueOnce({ deleted: ["a"], notFound: [], failed: ["b"] });
    expect((await POST(req({ entityType: "lead", ids: ["a", "b"] }))).status).toBe(207);
    deleteRecords.mockResolvedValueOnce({ deleted: [], notFound: [], failed: ["b"] });
    expect((await POST(req({ entityType: "lead", ids: ["b"] }))).status).toBe(500);
  });
});
