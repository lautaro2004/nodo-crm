import { beforeEach, describe, expect, it, vi } from "vitest";

const workspaceFind = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { workspace: { findUnique: (...a: unknown[]) => workspaceFind(...a) } } }));
const getNexoInquiry = vi.fn();
vi.mock("@/modules/nexo/inquiries", () => ({ getNexoInquiry: (...a: unknown[]) => getNexoInquiry(...a) }));
const upsertLeadFromSource = vi.fn();
vi.mock("@/modules/integrations/ingest", () => ({ upsertLeadFromSource: (...a: unknown[]) => upsertLeadFromSource(...a) }));

const { ingestNexoInquiry } = await import("./ingest-inquiry");

const INQUIRY = {
  id: "inq_1",
  businessId: "biz_A",
  customerName: "Ana",
  customerWhatsapp: "+5491155550000",
  customerEmail: "",
  message: "Coloración",
  status: "NEW",
  createdAt: new Date(),
  channel: "whatsapp",
  need: "Coloración",
  summary: "Quiere color el sábado",
  nodoLeadId: null,
};

beforeEach(() => vi.clearAllMocks());

describe("ingestNexoInquiry", () => {
  it.each(["pending", "discarded"])("una consulta %s queda retenida (no crea lead)", async (qualificationStatus) => {
    workspaceFind.mockResolvedValue({ businessId: "biz_A" });
    getNexoInquiry.mockResolvedValue({ ...INQUIRY, qualificationStatus });
    expect(await ingestNexoInquiry("biz_A", "inq_1")).toEqual({ outcome: "held" });
    expect(upsertLeadFromSource).not.toHaveBeenCalled();
  });

  it("nota de un contacto detectado en el chat (sin necesidad resumida)", async () => {
    const { nexoInquiryActivityBody } = await import("./ingest-inquiry");
    expect(nexoInquiryActivityBody({ ...INQUIRY, need: null, message: "Quiero sumar mi local" } as never)).toBe(
      "Contacto nuevo por WhatsApp (Nexo): Quiero sumar mi local"
    );
  });

  it("negocio sin Nodo: no hace nada", async () => {
    workspaceFind.mockResolvedValue(null);
    expect(await ingestNexoInquiry("biz_A", "inq_1")).toEqual({ outcome: "no_workspace" });
    expect(getNexoInquiry).not.toHaveBeenCalled();
  });

  it("lee la consulta del MISMO negocio (no confía en el payload)", async () => {
    workspaceFind.mockResolvedValue({ businessId: "biz_A" });
    getNexoInquiry.mockResolvedValue(null);
    expect(await ingestNexoInquiry("biz_A", "inq_de_otro")).toEqual({ outcome: "not_found" });
    expect(getNexoInquiry).toHaveBeenCalledWith("biz_A", "inq_de_otro");
  });

  it("crea o actualiza por la capa común de ingestión, con dedupe por email/teléfono", async () => {
    workspaceFind.mockResolvedValue({ businessId: "biz_A" });
    getNexoInquiry.mockResolvedValue(INQUIRY);
    upsertLeadFromSource.mockResolvedValue({ outcome: "updated", leadId: "lead_1", filled: [] });
    expect(await ingestNexoInquiry("biz_A", "inq_1")).toEqual({ outcome: "updated", leadId: "lead_1", filled: [] });
    const [businessId, input] = upsertLeadFromSource.mock.calls[0];
    expect(businessId).toBe("biz_A");
    expect(input).toMatchObject({
      source: "nexo_inquiry",
      sourceRef: "inq_1",
      createIfMissing: true,
      data: { name: "Ana", email: null, phone: "+5491155550000" },
    });
    expect(input.activity.body).toContain("asistente de Nexo");
    expect(input.activity.body).toContain("Resumen: Quiere color el sábado");
  });
});
