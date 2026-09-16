import { describe, expect, it, vi, beforeEach } from "vitest";

const leadFindUnique = vi.fn();
const leadCreate = vi.fn();
const listNexoAppointments = vi.fn();
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

vi.mock("@/modules/activities/service", () => ({
  createActivity: (...args: unknown[]) => activityCreate(...args),
}));

const { syncLeadsFromNexoAppointments } = await import("./sync-leads");

const APPOINTMENT = {
  id: "apt_1",
  businessId: "biz_A",
  serviceName: "Corte",
  customerName: "Juan Pérez",
  customerPhone: "+54 9 11 5555-0000",
  date: "2026-09-20",
  startTime: "10:00",
  status: "confirmed",
  createdAt: new Date("2026-09-18T10:00:00Z"),
};

beforeEach(() => {
  leadFindUnique.mockReset();
  leadCreate.mockReset();
  listNexoAppointments.mockReset();
  activityCreate.mockReset();
});

describe("1. Booking nuevo → Lead nuevo", () => {
  it("crea el Lead con los datos del turno y registra una Activity", async () => {
    listNexoAppointments.mockResolvedValue([APPOINTMENT]);
    leadFindUnique.mockResolvedValue(null);
    leadCreate.mockResolvedValue({ id: "lead_1" });

    const result = await syncLeadsFromNexoAppointments("biz_A");

    expect(leadCreate).toHaveBeenCalledWith({
      data: {
        businessId: "biz_A",
        name: "Juan Pérez",
        phone: "+54 9 11 5555-0000",
        status: "new",
        source: "nexo_appointment",
        sourceRef: "apt_1",
      },
    });
    expect(activityCreate).toHaveBeenCalledWith(
      "biz_A",
      expect.objectContaining({ relatedType: "lead", relatedId: "lead_1", type: "note" })
    );
    expect(result).toEqual({ created: 1, skipped: 0, total: 1 });
  });
});

describe("2. Mismo booking procesado dos veces → un solo Lead", () => {
  it("la segunda corrida encuentra el Lead existente (mismo businessId+source+sourceRef) y no crea otro", async () => {
    listNexoAppointments.mockResolvedValue([APPOINTMENT]);
    leadFindUnique.mockResolvedValue({ id: "lead_1", businessId: "biz_A", source: "nexo_appointment", sourceRef: "apt_1" });

    const result = await syncLeadsFromNexoAppointments("biz_A");

    expect(leadFindUnique).toHaveBeenCalledWith({
      where: { businessId_source_sourceRef: { businessId: "biz_A", source: "nexo_appointment", sourceRef: "apt_1" } },
    });
    expect(leadCreate).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, skipped: 1, total: 1 });
  });
});

describe("3/4. Multi-tenancy — un turno de Business A solo puede generar un Lead en el mismo negocio", () => {
  it("el sync SIEMPRE consulta y crea con el businessId recibido, nunca otro", async () => {
    listNexoAppointments.mockResolvedValue([{ ...APPOINTMENT, businessId: "biz_A" }]);
    leadFindUnique.mockResolvedValue(null);
    leadCreate.mockResolvedValue({ id: "lead_1" });

    await syncLeadsFromNexoAppointments("biz_A");

    expect(listNexoAppointments).toHaveBeenCalledWith("biz_A");
    expect(leadCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ businessId: "biz_A" }) }));
  });

  it("sincronizar Business B nunca consulta ni crea nada con el businessId de A", async () => {
    listNexoAppointments.mockResolvedValue([]); // B no tiene turnos propios en este escenario
    await syncLeadsFromNexoAppointments("biz_B");

    expect(listNexoAppointments).toHaveBeenCalledWith("biz_B");
    expect(listNexoAppointments).not.toHaveBeenCalledWith("biz_A");
    expect(leadCreate).not.toHaveBeenCalled();
  });
});

describe("5. Booking con datos incompletos — comportamiento controlado", () => {
  it("no crashea con un teléfono vacío; crea el Lead tal cual con los datos disponibles (no los inventa, no los descarta)", async () => {
    listNexoAppointments.mockResolvedValue([{ ...APPOINTMENT, customerPhone: "" }]);
    leadFindUnique.mockResolvedValue(null);
    leadCreate.mockResolvedValue({ id: "lead_1" });

    const result = await syncLeadsFromNexoAppointments("biz_A");

    expect(leadCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ phone: "" }) }));
    expect(result.created).toBe(1);
  });
});

describe("6. Booking cancelado — no se asume ni se pisa nada automáticamente", () => {
  it("si el Lead ya existe, el sync no lo toca sin importar el status ACTUAL del turno (cancelled incluido)", async () => {
    listNexoAppointments.mockResolvedValue([{ ...APPOINTMENT, status: "cancelled" }]);
    leadFindUnique.mockResolvedValue({ id: "lead_1" });

    await syncLeadsFromNexoAppointments("biz_A");

    // Ningún método de escritura sobre Lead más allá de create (que ni se llama acá).
    expect(leadCreate).not.toHaveBeenCalled();
  });
});

describe("7. Booking reprogramado — no duplica Lead", () => {
  it("reprogramar no cambia el id del turno (mismo sourceRef) — la segunda sync lo trata como ya existente", async () => {
    const reprogrammed = { ...APPOINTMENT, date: "2026-09-25", startTime: "15:00" }; // mismo id
    listNexoAppointments.mockResolvedValue([reprogrammed]);
    leadFindUnique.mockResolvedValue({ id: "lead_1" });

    const result = await syncLeadsFromNexoAppointments("biz_A");

    expect(result).toEqual({ created: 0, skipped: 1, total: 1 });
  });
});

describe("8/9. Fuente y referencia de origen correctamente almacenadas", () => {
  it("guarda source: 'nexo_appointment' y sourceRef: <Appointment.id> exactos", async () => {
    listNexoAppointments.mockResolvedValue([APPOINTMENT]);
    leadFindUnique.mockResolvedValue(null);
    leadCreate.mockResolvedValue({ id: "lead_1" });

    await syncLeadsFromNexoAppointments("biz_A");

    const call = leadCreate.mock.calls[0][0];
    expect(call.data.source).toBe("nexo_appointment");
    expect(call.data.sourceRef).toBe("apt_1");
  });
});
