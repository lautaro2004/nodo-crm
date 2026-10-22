import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ingestNexoInquiry = vi.fn();
vi.mock("@/modules/nexo/ingest-inquiry", () => ({ ingestNexoInquiry: (...a: unknown[]) => ingestNexoInquiry(...a) }));
vi.mock("@/modules/integrations/ingest", () => ({ safeErrorMessage: () => "Error inesperado al procesar" }));

const { POST } = await import("./route");

const req = (body: unknown, auth?: string) =>
  new Request("http://localhost/api/internal/nexo-inquiry", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXO_NODO_SYNC_SECRET = "s3cret";
});
afterEach(() => delete process.env.NEXO_NODO_SYNC_SECRET);

describe("POST /api/internal/nexo-inquiry", () => {
  it("rechaza sin el secreto correcto", async () => {
    expect((await POST(req({ businessId: "b", inquiryId: "i" }))).status).toBe(401);
    expect((await POST(req({ businessId: "b", inquiryId: "i" }, "Bearer otro"))).status).toBe(401);
    expect(ingestNexoInquiry).not.toHaveBeenCalled();
  });

  it("sin secreto configurado no acepta nada", async () => {
    delete process.env.NEXO_NODO_SYNC_SECRET;
    expect((await POST(req({ businessId: "b", inquiryId: "i" }, "Bearer "))).status).toBe(503);
  });

  it("valida el body", async () => {
    expect((await POST(req({ businessId: "" }, "Bearer s3cret"))).status).toBe(400);
  });

  it("devuelve el resultado y el lead", async () => {
    ingestNexoInquiry.mockResolvedValue({ outcome: "created", leadId: "lead_1" });
    const res = await POST(req({ businessId: "b", inquiryId: "i" }, "Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ outcome: "created", leadId: "lead_1" });
  });

  it("no_workspace y not_found", async () => {
    ingestNexoInquiry.mockResolvedValueOnce({ outcome: "no_workspace" });
    expect(await (await POST(req({ businessId: "b", inquiryId: "i" }, "Bearer s3cret"))).json()).toEqual({ outcome: "no_workspace", leadId: null });
    ingestNexoInquiry.mockResolvedValueOnce({ outcome: "not_found" });
    expect((await POST(req({ businessId: "b", inquiryId: "i" }, "Bearer s3cret"))).status).toBe(404);
  });

  it("errores internos: 500 sin detalles", async () => {
    ingestNexoInquiry.mockRejectedValue(new Error("boom"));
    const res = await POST(req({ businessId: "b", inquiryId: "i" }, "Bearer s3cret"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error inesperado al procesar" });
  });
});
