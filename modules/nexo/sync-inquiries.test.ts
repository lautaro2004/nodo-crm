import { describe, expect, it, vi, beforeEach } from "vitest";

const leadFindUnique = vi.fn();
const leadCreate = vi.fn();
const listNexoAppointments = vi.fn();
const listNexoInquiries = vi.fn();
const activityCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findUnique: (...args: unknown[]) => leadFindUnique(...args),
      create: (...args: unknown[]) => leadCreate(...args),
    },
  },
}));

vi.mock("@/modules/nexo/appointments", () => ({
  listNexoAppointments: (...args: unknown[]) => listNexoAppointments(...args),
}));

vi.mock("@/modules/nexo/inquiries", () => ({
  listNexoInquiries: (...args: unknown[]) => listNexoInquiries(...args),
}));

vi.mock("@/modules/activities/service", () => ({
  createActivity: (...args: unknown[]) => activityCreate(...args),
}));

const { syncLeadsFromNexoInquiries, syncLeadsFromNexo } = await import("./sync-leads");

const INQUIRY = {
  id: "inq_1",
  businessId: "biz_A",
  customerName: "Ana Pérez",
  customerWhatsapp: "+54 9 11 5555-0000",
  customerEmail: "ana@example.com",
  message: "¿Tienen turnos el sábado?",
  status: "NEW",
  createdAt: new Date("2026-09-20T10:00:00Z"),
};

beforeEach(() => {
  leadFindUnique.mockReset();
  leadCreate.mockReset();
  listNexoAppointments.mockReset().mockResolvedValue([]);
  listNexoInquiries.mockReset();
  activityCreate.mockReset();
});

describe("syncLeadsFromNexoInquiries", () => {
  it("crea un Lead con email/teléfono de la consulta y guarda el mensaje como nota", async () => {
    listNexoInquiries.mockResolvedValue([INQUIRY]);
    leadFindUnique.mockResolvedValue(null);
    leadCreate.mockResolvedValue({ id: "lead_1" });

    const result = await syncLeadsFromNexoInquiries("biz_A");

    expect(listNexoInquiries).toHaveBeenCalledWith("biz_A");
    expect(leadCreate).toHaveBeenCalledWith({
      data: {
        businessId: "biz_A",
        name: "Ana Pérez",
        email: "ana@example.com",
        phone: "+54 9 11 5555-0000",
        status: "new",
        source: "nexo_inquiry",
        sourceRef: "inq_1",
      },
    });
    expect(activityCreate).toHaveBeenCalledWith(
      "biz_A",
      expect.objectContaining({
        relatedType: "lead",
        relatedId: "lead_1",
        type: "note",
        body: expect.stringContaining("¿Tienen turnos el sábado?"),
      })
    );
    expect(result).toEqual({ created: 1, skipped: 0, total: 1 });
  });

  it("es idempotente: una consulta ya sincronizada no genera otro Lead", async () => {
    listNexoInquiries.mockResolvedValue([INQUIRY]);
    leadFindUnique.mockResolvedValue({ id: "lead_1" });

    const result = await syncLeadsFromNexoInquiries("biz_A");

    expect(leadFindUnique).toHaveBeenCalledWith({
      where: { businessId_source_sourceRef: { businessId: "biz_A", source: "nexo_inquiry", sourceRef: "inq_1" } },
    });
    expect(leadCreate).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, skipped: 1, total: 1 });
  });

  it("sin consultas no hace nada", async () => {
    listNexoInquiries.mockResolvedValue([]);
    expect(await syncLeadsFromNexoInquiries("biz_A")).toEqual({ created: 0, skipped: 0, total: 0 });
    expect(leadCreate).not.toHaveBeenCalled();
  });
});

describe("syncLeadsFromNexo (acción única del botón)", () => {
  it("corre turnos y consultas, y combina los totales", async () => {
    listNexoAppointments.mockResolvedValue([
      {
        id: "apt_1",
        businessId: "biz_A",
        serviceName: "Corte",
        customerName: "Juan",
        customerPhone: "1",
        date: "2026-09-21",
        startTime: "10:00",
        status: "confirmed",
        createdAt: new Date(),
      },
    ]);
    listNexoInquiries.mockResolvedValue([INQUIRY]);
    leadFindUnique.mockResolvedValue(null);
    leadCreate.mockResolvedValue({ id: "lead_x" });

    const result = await syncLeadsFromNexo("biz_A");

    expect(result.created).toBe(2);
    expect(result.total).toBe(2);
    expect(result.appointments.created).toBe(1);
    expect(result.inquiries.created).toBe(1);
    expect(leadCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ source: "nexo_appointment" }) });
    expect(leadCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ source: "nexo_inquiry" }) });
  });
});
