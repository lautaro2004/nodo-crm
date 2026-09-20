import { describe, expect, it, vi, beforeEach } from "vitest";

const tplCreate = vi.fn();
const tplFindMany = vi.fn();
const tplFindFirst = vi.fn();
const tplUpdate = vi.fn();
const tplDeleteMany = vi.fn();
const settingsFindUnique = vi.fn();
const settingsUpsert = vi.fn();
const contactFindFirst = vi.fn();
const leadFindFirst = vi.fn();
const opportunityFindFirst = vi.fn();
const userFindUnique = vi.fn();
const activityCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailTemplate: {
      create: (...a: unknown[]) => tplCreate(...a),
      findMany: (...a: unknown[]) => tplFindMany(...a),
      findFirst: (...a: unknown[]) => tplFindFirst(...a),
      update: (...a: unknown[]) => tplUpdate(...a),
      deleteMany: (...a: unknown[]) => tplDeleteMany(...a),
    },
    emailSettings: { findUnique: (...a: unknown[]) => settingsFindUnique(...a), upsert: (...a: unknown[]) => settingsUpsert(...a) },
    contact: { findFirst: (...a: unknown[]) => contactFindFirst(...a) },
    lead: { findFirst: (...a: unknown[]) => leadFindFirst(...a) },
    opportunity: { findFirst: (...a: unknown[]) => opportunityFindFirst(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    activity: { create: (...a: unknown[]) => activityCreate(...a) },
  },
}));

const templates = await import("./templates");
const settings = await import("./settings");
const send = await import("./send");
const { resolveEntityContext } = await import("./variables");

const READY = { businessId: "biz-a", provider: "sandbox", fromEmail: "ventas@a.com", fromName: "A" };

beforeEach(() => {
  for (const m of [tplCreate, tplFindMany, tplFindFirst, tplUpdate, tplDeleteMany, settingsFindUnique, settingsUpsert, contactFindFirst, leadFindFirst, opportunityFindFirst, userFindUnique, activityCreate]) m.mockReset();
  activityCreate.mockResolvedValue({});
  settingsFindUnique.mockResolvedValue(READY);
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
});

describe("plantillas", () => {
  it("lista sólo las del negocio", async () => {
    tplFindMany.mockResolvedValue([]);
    await templates.listTemplates("biz-a");
    expect(tplFindMany.mock.calls[0][0].where).toEqual({ businessId: "biz-a" });
  });

  it("crea con businessId del servidor", async () => {
    tplCreate.mockResolvedValue({ id: "t1" });
    await templates.createTemplate("biz-a", { name: "Bienvenida", subject: "Hola", bodyHtml: "<p>x</p>" });
    expect(tplCreate.mock.calls[0][0].data).toMatchObject({ businessId: "biz-a", name: "Bienvenida" });
  });

  it("nombre duplicado en el mismo negocio -> template_name_taken", async () => {
    tplCreate.mockRejectedValue({ code: "P2002" });
    await expect(templates.createTemplate("biz-a", { name: "x", subject: "s", bodyHtml: "b" })).rejects.toThrow("template_name_taken");
  });

  it("edita sólo si pertenece al negocio", async () => {
    tplFindFirst.mockResolvedValue(null);
    expect(await templates.updateTemplate("biz-b", "t1", { subject: "hack" })).toBeNull();
    expect(tplFindFirst.mock.calls[0][0].where).toEqual({ id: "t1", businessId: "biz-b" });
    expect(tplUpdate).not.toHaveBeenCalled();

    tplFindFirst.mockResolvedValue({ id: "t1" });
    tplUpdate.mockResolvedValue({ id: "t1", subject: "nuevo" });
    await templates.updateTemplate("biz-a", "t1", { subject: "nuevo" });
    expect(tplUpdate).toHaveBeenCalledWith({ where: { id: "t1" }, data: { subject: "nuevo" } });
  });

  it("elimina acotado por negocio", async () => {
    tplDeleteMany.mockResolvedValue({ count: 0 });
    expect(await templates.deleteTemplate("biz-b", "t1")).toBe(false);
    expect(tplDeleteMany).toHaveBeenCalledWith({ where: { id: "t1", businessId: "biz-b" } });
    tplDeleteMany.mockResolvedValue({ count: 1 });
    expect(await templates.deleteTemplate("biz-a", "t1")).toBe(true);
  });
});

describe("configuración", () => {
  it("estado derivado", () => {
    expect(settings.deriveConfigStatus(null)).toBe("not_configured");
    expect(settings.deriveConfigStatus({ provider: "sandbox", fromEmail: null })).toBe("not_configured");
    expect(settings.deriveConfigStatus({ provider: "sandbox", fromEmail: "a@a.com" })).toBe("sandbox");
    expect(settings.deriveConfigStatus({ provider: "resend", fromEmail: "a@a.com" })).toBe("provider_unavailable");
    process.env.RESEND_API_KEY = "re_x";
    expect(settings.deriveConfigStatus({ provider: "resend", fromEmail: "a@a.com" })).toBe("ready");
  });

  it("upsert acotado al negocio", async () => {
    settingsUpsert.mockResolvedValue(READY);
    await settings.upsertEmailSettings("biz-a", { provider: "sandbox", fromEmail: "ventas@a.com", fromName: "A" });
    expect(settingsUpsert.mock.calls[0][0].where).toEqual({ businessId: "biz-a" });
    expect(settingsUpsert.mock.calls[0][0].create.businessId).toBe("biz-a");
  });
});

describe("resolución de variables por entidad", () => {
  it("contacto: contact.name + company.name, destinatario = su email", async () => {
    contactFindFirst.mockResolvedValue({ name: "Ana", email: "ana@x.com", company: { name: "Acme" } });
    const ctx = await resolveEntityContext("biz-a", "contact", "c1");
    expect(contactFindFirst.mock.calls[0][0].where).toEqual({ id: "c1", businessId: "biz-a" });
    expect(ctx).toEqual({ values: { "contact.name": "Ana", "company.name": "Acme" }, recipient: { email: "ana@x.com", name: "Ana" } });
  });

  it("lead: lead.name, destinatario = email del lead", async () => {
    leadFindFirst.mockResolvedValue({ name: "Lea", email: "lea@x.com", company: null, convertedContact: null });
    const ctx = await resolveEntityContext("biz-a", "lead", "l1");
    expect(ctx?.values).toEqual({ "lead.name": "Lea" });
    expect(ctx?.recipient?.email).toBe("lea@x.com");
  });

  it("oportunidad: opportunity.name, destinatario = email de su contacto", async () => {
    opportunityFindFirst.mockResolvedValue({ title: "Proy", company: { name: "Acme" }, contact: { name: "Ana", email: "ana@x.com" } });
    const ctx = await resolveEntityContext("biz-a", "opportunity", "o1");
    expect(ctx?.values).toEqual({ "opportunity.name": "Proy", "company.name": "Acme", "contact.name": "Ana" });
    expect(ctx?.recipient?.email).toBe("ana@x.com");
  });

  it("entidad de otro negocio -> null (aislamiento)", async () => {
    contactFindFirst.mockResolvedValue(null);
    expect(await resolveEntityContext("biz-b", "contact", "c-de-a")).toBeNull();
  });

  it("sin email -> recipient null", async () => {
    contactFindFirst.mockResolvedValue({ name: "Ana", email: null, company: null });
    expect((await resolveEntityContext("biz-a", "contact", "c1"))?.recipient).toBeNull();
  });
});

describe("previewEntityEmail", () => {
  it("resuelve plantilla + entidad, escapa HTML y lista lo pendiente", async () => {
    contactFindFirst.mockResolvedValue({ name: "<b>Ana</b>", email: "ana@x.com", company: null });
    tplFindFirst.mockResolvedValue({ subject: "Hola {{contact.name}}", bodyHtml: "<p>{{contact.name}} - {{company.name}}</p>" });
    const p = await send.previewEntityEmail("biz-a", "contact", "c1", { templateId: "t1" });
    expect(tplFindFirst.mock.calls[0][0].where).toEqual({ id: "t1", businessId: "biz-a" });
    expect(p.subject).toBe("Hola <b>Ana</b>");
    expect(p.bodyHtml).toBe("<p>&lt;b&gt;Ana&lt;/b&gt; - {{company.name}}</p>");
    expect(p.unresolved).toEqual(["company.name"]);
  });

  it("plantilla de otro negocio -> template_not_found", async () => {
    contactFindFirst.mockResolvedValue({ name: "Ana", email: "a@x.com", company: null });
    tplFindFirst.mockResolvedValue(null);
    await expect(send.previewEntityEmail("biz-b", "contact", "c1", { templateId: "t-de-a" })).rejects.toThrow("template_not_found");
  });
});

describe("sendEntityEmail", () => {
  const input = { subject: "Hola Ana", bodyHtml: "<p>Hola</p>" };
  beforeEach(() => contactFindFirst.mockResolvedValue({ name: "Ana", email: "ana@x.com", company: null }));

  it("sandbox: simula el envío y registra Activity type email con destinatario, asunto y estado", async () => {
    const r = await send.sendEntityEmail("biz-a", "u1", "contact", "c1", input);
    expect(r).toEqual({ status: "simulated", to: "ana@x.com" });
    const data = activityCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ businessId: "biz-a", relatedType: "contact", relatedId: "c1", type: "email", ownerId: "u1" });
    expect(data.body).toContain("Para: ana@x.com");
    expect(data.body).toContain("Asunto: Hola Ana");
    expect(data.body).toContain("Estado: Simulado");
  });

  it("resend OK: estado Enviado y llamada a la API con remitente del negocio", async () => {
    process.env.RESEND_API_KEY = "re_test";
    settingsFindUnique.mockResolvedValue({ ...READY, provider: "resend" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "msg1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const r = await send.sendEntityEmail("biz-a", "u1", "contact", "c1", input);
    expect(r.status).toBe("sent");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ from: "A <ventas@a.com>", to: ["ana@x.com"], subject: "Hola Ana" });
    expect(activityCreate.mock.calls[0][0].data.body).toContain("Estado: Enviado");
  });

  it("resend falla: devuelve failed y también deja Activity", async () => {
    process.env.RESEND_API_KEY = "re_test";
    settingsFindUnique.mockResolvedValue({ ...READY, provider: "resend" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ message: "dominio no verificado" }) }));
    const r = await send.sendEntityEmail("biz-a", "u1", "contact", "c1", input);
    expect(r).toMatchObject({ status: "failed", error: "dominio no verificado" });
    expect(activityCreate.mock.calls[0][0].data.body).toContain("Estado: Falló");
  });

  it("rechaza sin configuración, sin destinatario y con variables sin resolver — sin Activity", async () => {
    settingsFindUnique.mockResolvedValue(null);
    await expect(send.sendEntityEmail("biz-a", "u1", "contact", "c1", input)).rejects.toThrow("email_not_configured");

    settingsFindUnique.mockResolvedValue(READY);
    await expect(send.sendEntityEmail("biz-a", "u1", "contact", "c1", { subject: "Hola {{lead.name}}", bodyHtml: "x" })).rejects.toThrow("unresolved_variables");

    contactFindFirst.mockResolvedValue({ name: "Ana", email: null, company: null });
    await expect(send.sendEntityEmail("biz-a", "u1", "contact", "c1", input)).rejects.toThrow("recipient_missing");
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("entidad de otro negocio -> entity_not_found y no envía", async () => {
    contactFindFirst.mockResolvedValue(null);
    await expect(send.sendEntityEmail("biz-b", "u2", "contact", "c-de-a", input)).rejects.toThrow("entity_not_found");
    expect(contactFindFirst.mock.calls[0][0].where).toEqual({ id: "c-de-a", businessId: "biz-b" });
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("usa la configuración del negocio que envía, no la de otro", async () => {
    await send.sendEntityEmail("biz-a", "u1", "contact", "c1", input);
    expect(settingsFindUnique).toHaveBeenCalledWith({ where: { businessId: "biz-a" } });
  });
});

describe("sendTestEmail", () => {
  it("va al email del usuario en sesión, con datos de ejemplo y sin Activity", async () => {
    tplFindFirst.mockResolvedValue({ subject: "Hola {{contact.name}}", bodyHtml: "<p>{{company.name}}</p>" });
    userFindUnique.mockResolvedValue({ email: "yo@a.com" });
    const r = await send.sendTestEmail("biz-a", "u1", "t1");
    expect(r).toEqual({ status: "simulated", to: "yo@a.com" });
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("plantilla ajena -> template_not_found", async () => {
    tplFindFirst.mockResolvedValue(null);
    await expect(send.sendTestEmail("biz-b", "u2", "t-de-a")).rejects.toThrow("template_not_found");
  });
});
