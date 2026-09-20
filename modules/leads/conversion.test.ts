import { describe, expect, it, vi, beforeEach } from "vitest";

const leadFindFirst = vi.fn();
const contactFindFirst = vi.fn();
const contactCreate = vi.fn();
const pipelineFindFirst = vi.fn();
const pipelineStageFindFirst = vi.fn();
const opportunityCreate = vi.fn();
const leadUpdateMany = vi.fn();
const membershipFindFirst = vi.fn();
const entityTagCreateMany = vi.fn();
const activityCreate = vi.fn();
const leadFindFirstOutsideTx = vi.fn();
const listTagsForEntity = vi.fn();

const tx = {
  lead: { findFirst: leadFindFirst, updateMany: leadUpdateMany },
  contact: { findFirst: contactFindFirst, create: contactCreate },
  pipeline: { findFirst: pipelineFindFirst },
  pipelineStage: { findFirst: pipelineStageFindFirst },
  opportunity: { create: opportunityCreate },
  membership: { findFirst: membershipFindFirst },
  entityTag: { createMany: entityTagCreateMany },
  activity: { create: activityCreate },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (tx: unknown) => unknown) => callback(tx),
    lead: { findFirst: (...args: unknown[]) => leadFindFirstOutsideTx(...args) },
  },
}));

vi.mock("@/modules/tags/service", () => ({
  listTagsForEntity: (...args: unknown[]) => listTagsForEntity(...args),
}));

const { convertLead, findPossibleDuplicateContacts, ConversionError, AlreadyConvertedError } = await import("./conversion");

beforeEach(() => {
  leadFindFirst.mockReset();
  contactFindFirst.mockReset();
  contactCreate.mockReset();
  pipelineFindFirst.mockReset();
  pipelineStageFindFirst.mockReset();
  opportunityCreate.mockReset();
  leadUpdateMany.mockReset();
  membershipFindFirst.mockReset();
  entityTagCreateMany.mockReset();
  activityCreate.mockReset();
  leadFindFirstOutsideTx.mockReset();
  listTagsForEntity.mockReset();
  listTagsForEntity.mockResolvedValue([]);
  activityCreate.mockResolvedValue({ id: "activity_1" });
  leadUpdateMany.mockResolvedValue({ count: 1 });
});

const BASE_LEAD = {
  id: "lead_1",
  businessId: "biz_1",
  name: "Juan Pérez",
  email: "juan@test.com",
  phone: "+54911",
  companyId: "company_1",
  convertedAt: null,
};

describe("convertLead — Contact", () => {
  it("crea un nuevo Contact a partir del Lead (caso 1)", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD);
    contactCreate.mockResolvedValue({ id: "contact_new" });

    await convertLead("biz_1", "lead_1", { contact: { mode: "new" }, createOpportunity: false }, "user_1");

    expect(contactCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: "biz_1",
          name: "Juan Pérez",
          email: "juan@test.com",
          phone: "+54911",
          companyId: "company_1", // reusa la Company del Lead (sección 9)
          ownerId: "user_1",
        }),
      })
    );
    expect(leadUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead_1", businessId: "biz_1", convertedAt: null },
        data: expect.objectContaining({ status: "converted", convertedContactId: "contact_new", convertedOpportunityId: null }),
      })
    );
  });

  it("usa un Contact existente del mismo Business (caso 2)", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD);
    contactFindFirst.mockResolvedValue({ id: "contact_existing" });

    await convertLead("biz_1", "lead_1", { contact: { mode: "existing", contactId: "contact_existing" }, createOpportunity: false }, "user_1");

    expect(contactFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "contact_existing", businessId: "biz_1" } }));
    expect(contactCreate).not.toHaveBeenCalled();
    expect(leadUpdateMany.mock.calls[0][0].data.convertedContactId).toBe("contact_existing");
  });
});

describe("convertLead — Opportunity", () => {
  it("crea Contact + Opportunity usando el Pipeline/Stage correctos (casos 3 y 4)", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD);
    contactCreate.mockResolvedValue({ id: "contact_new" });
    pipelineFindFirst.mockResolvedValue({ id: "pipeline_1" });
    pipelineStageFindFirst.mockResolvedValue({ id: "stage_1" });
    opportunityCreate.mockResolvedValue({ id: "opp_1" });

    await convertLead(
      "biz_1",
      "lead_1",
      {
        contact: { mode: "new" },
        createOpportunity: true,
        opportunity: { title: "Desarrollo Web", pipelineId: "pipeline_1", stageId: "stage_1", amount: 1000 },
      },
      "user_1"
    );

    expect(pipelineFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "pipeline_1", businessId: "biz_1" } }));
    expect(pipelineStageFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "stage_1", pipelineId: "pipeline_1" } }));
    expect(opportunityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: "biz_1",
          title: "Desarrollo Web",
          companyId: "company_1",
          contactId: "contact_new",
          pipelineId: "pipeline_1",
          stageId: "stage_1",
          amount: 1000,
        }),
      })
    );
    expect(leadUpdateMany.mock.calls[0][0].data.convertedOpportunityId).toBe("opp_1");
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ relatedType: "opportunity", relatedId: "opp_1" }) })
    );
  });
});

describe("convertLead — Responsable", () => {
  it("asigna la oportunidad a un miembro del mismo Business (caso 7)", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD);
    contactCreate.mockResolvedValue({ id: "contact_new" });
    pipelineFindFirst.mockResolvedValue({ id: "pipeline_1" });
    pipelineStageFindFirst.mockResolvedValue({ id: "stage_1" });
    membershipFindFirst.mockResolvedValue({ id: "membership_1" });
    opportunityCreate.mockResolvedValue({ id: "opp_1" });

    await convertLead(
      "biz_1",
      "lead_1",
      {
        contact: { mode: "new" },
        createOpportunity: true,
        opportunity: { title: "Desarrollo Web", pipelineId: "pipeline_1", stageId: "stage_1", ownerId: "user_2" },
      },
      "user_1"
    );

    expect(membershipFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: "biz_1", userId: "user_2" } }));
    expect(opportunityCreate.mock.calls[0][0].data.ownerId).toBe("user_2");
  });

  it("rechaza asignar a un usuario de OTRO Business (caso 8)", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD);
    contactCreate.mockResolvedValue({ id: "contact_new" });
    pipelineFindFirst.mockResolvedValue({ id: "pipeline_1" });
    pipelineStageFindFirst.mockResolvedValue({ id: "stage_1" });
    membershipFindFirst.mockResolvedValue(null);

    await expect(
      convertLead(
        "biz_1",
        "lead_1",
        {
          contact: { mode: "new" },
          createOpportunity: true,
          opportunity: { title: "Desarrollo Web", pipelineId: "pipeline_1", stageId: "stage_1", ownerId: "user_de_otro_biz" },
        },
        "user_1"
      )
    ).rejects.toThrow("user_not_in_business");
    expect(opportunityCreate).not.toHaveBeenCalled();
    expect(leadUpdateMany).not.toHaveBeenCalled();
  });
});

describe("convertLead — seguridad multi-tenant (casos 9 y 10)", () => {
  it("rechaza convertir usando un Contact de OTRO Business", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD);
    contactFindFirst.mockResolvedValue(null); // scopeado por businessId — un id de otro Business nunca matchea

    await expect(
      convertLead("biz_1", "lead_1", { contact: { mode: "existing", contactId: "contact_de_biz_B" }, createOpportunity: false }, "user_1")
    ).rejects.toThrow(ConversionError);
    expect(leadUpdateMany).not.toHaveBeenCalled();
  });

  it("rechaza usar un Pipeline de OTRO Business", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD);
    contactCreate.mockResolvedValue({ id: "contact_new" });
    pipelineFindFirst.mockResolvedValue(null); // scopeado por businessId

    await expect(
      convertLead(
        "biz_1",
        "lead_1",
        { contact: { mode: "new" }, createOpportunity: true, opportunity: { title: "X", pipelineId: "pipeline_de_biz_B", stageId: "s" } },
        "user_1"
      )
    ).rejects.toThrow("pipeline_not_found");
    expect(opportunityCreate).not.toHaveBeenCalled();
  });
});

describe("convertLead — idempotencia (caso 5)", () => {
  it("lanza AlreadyConvertedError si el Lead ya estaba convertido", async () => {
    leadFindFirst.mockResolvedValue({ ...BASE_LEAD, convertedAt: new Date() });
    leadFindFirstOutsideTx.mockResolvedValue({ ...BASE_LEAD, convertedAt: new Date(), convertedContact: { id: "c1", name: "Juan" }, convertedOpportunity: null });

    await expect(convertLead("biz_1", "lead_1", { contact: { mode: "new" }, createOpportunity: false }, "user_1")).rejects.toThrow(
      AlreadyConvertedError
    );
    expect(contactCreate).not.toHaveBeenCalled();
  });

  it("aborta si el UPDATE guardado devuelve count 0 (carrera entre dos requests simultáneas)", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD); // todavía no convertido al leer
    contactCreate.mockResolvedValue({ id: "contact_new" });
    leadUpdateMany.mockResolvedValue({ count: 0 }); // otra request ganó la carrera
    leadFindFirstOutsideTx.mockResolvedValue({ ...BASE_LEAD, convertedAt: new Date(), convertedContact: null, convertedOpportunity: null });

    await expect(convertLead("biz_1", "lead_1", { contact: { mode: "new" }, createOpportunity: false }, "user_1")).rejects.toThrow(
      AlreadyConvertedError
    );
  });
});

describe("convertLead — Company (caso 6)", () => {
  it("reusa la Company del Lead en el Contact y en la Opportunity, sin crear una nueva", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD);
    contactCreate.mockResolvedValue({ id: "contact_new" });
    pipelineFindFirst.mockResolvedValue({ id: "pipeline_1" });
    pipelineStageFindFirst.mockResolvedValue({ id: "stage_1" });
    opportunityCreate.mockResolvedValue({ id: "opp_1" });

    await convertLead(
      "biz_1",
      "lead_1",
      { contact: { mode: "new" }, createOpportunity: true, opportunity: { title: "X", pipelineId: "pipeline_1", stageId: "stage_1" } },
      "user_1"
    );

    expect(contactCreate.mock.calls[0][0].data.companyId).toBe("company_1");
    expect(opportunityCreate.mock.calls[0][0].data.companyId).toBe("company_1");
  });
});

describe("convertLead — historial (caso 11)", () => {
  it("genera una Activity 'converted' en el Lead", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD);
    contactCreate.mockResolvedValue({ id: "contact_new" });

    await convertLead("biz_1", "lead_1", { contact: { mode: "new" }, createOpportunity: false }, "user_1");

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ relatedType: "lead", relatedId: "lead_1", type: "converted", body: "Lead convertido", ownerId: "user_1" }),
      })
    );
  });
});

describe("convertLead — fallos no dejan datos parciales (caso 12)", () => {
  it("si falla la validación del Stage, no llega a marcar el Lead como convertido", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD);
    contactCreate.mockResolvedValue({ id: "contact_new" });
    pipelineFindFirst.mockResolvedValue({ id: "pipeline_1" });
    pipelineStageFindFirst.mockResolvedValue(null);

    await expect(
      convertLead(
        "biz_1",
        "lead_1",
        { contact: { mode: "new" }, createOpportunity: true, opportunity: { title: "X", pipelineId: "pipeline_1", stageId: "stage_de_otro_pipeline" } },
        "user_1"
      )
    ).rejects.toThrow("stage_not_found");
    expect(leadUpdateMany).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
  });
});

describe("convertLead — transferencia de datos (caso 13)", () => {
  it("copia name/email/phone/companyId del Lead al nuevo Contact", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD);
    contactCreate.mockResolvedValue({ id: "contact_new" });

    await convertLead("biz_1", "lead_1", { contact: { mode: "new" }, createOpportunity: false }, "user_1");

    expect(contactCreate.mock.calls[0][0].data).toMatchObject({
      name: BASE_LEAD.name,
      email: BASE_LEAD.email,
      phone: BASE_LEAD.phone,
      companyId: BASE_LEAD.companyId,
    });
  });

  it("copia los tags del Lead al Contact SOLO cuando el Contact es nuevo", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD);
    contactCreate.mockResolvedValue({ id: "contact_new" });
    listTagsForEntity.mockResolvedValue([{ id: "tag_1" }, { id: "tag_2" }]);

    await convertLead("biz_1", "lead_1", { contact: { mode: "new" }, createOpportunity: false }, "user_1");

    expect(entityTagCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { businessId: "biz_1", tagId: "tag_1", entityType: "contact", entityId: "contact_new" },
          { businessId: "biz_1", tagId: "tag_2", entityType: "contact", entityId: "contact_new" },
        ],
      })
    );
  });

  it("NO copia tags cuando se reusa un Contact existente", async () => {
    leadFindFirst.mockResolvedValue(BASE_LEAD);
    contactFindFirst.mockResolvedValue({ id: "contact_existing" });
    listTagsForEntity.mockResolvedValue([{ id: "tag_1" }]);

    await convertLead("biz_1", "lead_1", { contact: { mode: "existing", contactId: "contact_existing" }, createOpportunity: false }, "user_1");

    expect(entityTagCreateMany).not.toHaveBeenCalled();
  });
});

describe("findPossibleDuplicateContacts", () => {
  it("busca por email/phone del Lead, nunca por nombre", async () => {
    leadFindFirstOutsideTx.mockResolvedValue({ email: "juan@test.com", phone: "+54911" });
    const contactFindMany = vi.fn().mockResolvedValue([]);
    // sustituye temporalmente prisma.contact.findMany para este test puntual
    const prismaModule = await import("@/lib/prisma");
    (prismaModule.prisma as unknown as { contact: { findMany: typeof contactFindMany } }).contact = { findMany: contactFindMany };

    await findPossibleDuplicateContacts("biz_1", "lead_1");

    expect(contactFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: "biz_1", OR: [{ email: "juan@test.com" }, { phone: "+54911" }] },
      })
    );
  });

  it("devuelve vacío si el Lead no tiene ni email ni teléfono", async () => {
    leadFindFirstOutsideTx.mockResolvedValue({ email: null, phone: null });
    const matches = await findPossibleDuplicateContacts("biz_1", "lead_1");
    expect(matches).toEqual([]);
  });
});
