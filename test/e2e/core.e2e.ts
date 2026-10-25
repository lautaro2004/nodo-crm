import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { moduleEntityType } from "@/lib/custom-modules";
import { customFieldKey } from "@/lib/entities";
import { createModule, listModuleFields } from "@/modules/custom-modules/service";
import { createRecord, updateRecord } from "@/modules/custom-modules/records";
import { createContact, updateContact } from "@/modules/contacts/service";
import { createLead, updateLead } from "@/modules/leads/service";
import { incomingLinks } from "@/modules/records/links";
import { getOptionUsage, updateCustomFieldDefinition, OptionInUseError, createCustomFieldDefinition } from "@/modules/custom-fields/service";
import { createRule } from "@/modules/automations/service";
import { AutomationRequirementError } from "@/modules/automations/workflow";
import { resolveAccess, setMemberAccess, createTeam, updateTeam, scopeWhere } from "@/modules/access/service";
import { listLeads } from "@/modules/leads/service";
import { computeWidgets } from "@/modules/reports/dashboards";
import { getPreference, setPreference } from "@/modules/preferences/service";

const B = `biz_${Date.now().toString(36)}`;
const OWNER = `${B}_owner`;
const SELLER = `${B}_seller`;
const SELLER2 = `${B}_seller2`;
const owner = { userId: OWNER, role: "owner" };
let colab: { id: string };
let fields: Awaited<ReturnType<typeof listModuleFields>>;
const field = (key: string) => fields.find((f) => f.key === key)!;

beforeAll(async () => {
  await prisma.business.create({ data: { id: B, name: "E2E" } });
  for (const [id, role] of [
    [OWNER, "owner"],
    [SELLER, "member"],
    [SELLER2, "member"],
  ]) {
    await prisma.user.create({ data: { id, name: id, email: `${id}@test.local` } });
    await prisma.membership.create({ data: { userId: id, businessId: B, role, products: ["crm"] } });
  }
  await prisma.workspace.create({ data: { businessId: B, activeModules: ["contacts", "leads"] } });
  colab = await createModule(B, { labelSingular: "Colaboración", labelPlural: "Colaboraciones", templateId: "colaboraciones" });
  fields = await listModuleFields(B, colab.id);
});

describe("relaciones reales entre módulos", () => {
  it("la plantilla Colaboraciones crea la relación con Contactos y la vista inversa la muestra en el contacto", async () => {
    const contact = await createContact(B, { name: "Ana Proveedora", phone: "111" });
    await createRecord(B, colab.id, OWNER, { title: "Máquina X", values: { [field("contacto").id]: contact.id } });
    await createRecord(B, colab.id, OWNER, { title: "Máquina Y", values: { [field("contacto").id]: contact.id } });
    const groups = await incomingLinks(B, "contact", contact.id);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Colaboraciones");
    expect(groups[0].items.map((i) => i.label).sort()).toEqual(["Máquina X", "Máquina Y"]);
    // Valor predeterminado aplicado en el alta.
    const rec = await prisma.customFieldValue.findFirst({ where: { definitionId: field("estado").id } });
    expect(rec?.value).toBe("Pendiente");
  });

  it("uno a uno: la base impide vincular el mismo destino dos veces", async () => {
    const def = await createCustomFieldDefinition(B, { entityType: moduleEntityType(colab.id), key: "garantia", label: "Garantía de", type: "relation", targetEntity: "contact", exclusive: true });
    const c = await createContact(B, { name: "Único" });
    await createRecord(B, colab.id, OWNER, { title: "A", values: { [def.id]: c.id } });
    await expect(createRecord(B, colab.id, OWNER, { title: "B", values: { [def.id]: c.id } })).rejects.toThrow();
    expect(await prisma.customRecord.count({ where: { businessId: B, title: "B" } })).toBe(0);
  });
});

describe("campos editables sin perder datos", () => {
  it("renombrar migra valores; quitar una opción en uso exige estrategia", async () => {
    const motivo = field("motivo_rechazo");
    await createRecord(B, colab.id, OWNER, { title: "Z", values: { [motivo.id]: "Otro" } });
    await updateCustomFieldDefinition(B, motivo.id, { options: [...motivo.options.filter((o) => o !== "Otro"), "Otros motivos"], optionRenames: [{ from: "Otro", to: "Otros motivos" }] });
    expect((await getOptionUsage(B, motivo.id))!.byOption["Otros motivos"]).toBe(1);

    await expect(updateCustomFieldDefinition(B, motivo.id, { options: ["No cumple requisitos"] })).rejects.toBeInstanceOf(OptionInUseError);
    await updateCustomFieldDefinition(B, motivo.id, { options: ["No cumple requisitos"], removedOptions: { "Otros motivos": { action: "replace", replaceWith: "No cumple requisitos" } } });
    expect((await getOptionUsage(B, motivo.id))!.byOption["No cumple requisitos"]).toBe(1);
  });
});

describe("automatizaciones genéricas", () => {
  it("antes de guardar: al pasar a Rechazada exige el motivo, y con motivo guarda", async () => {
    const estado = customFieldKey(field("estado").id);
    const motivo = customFieldKey(field("motivo_rechazo").id);
    await createRule(B, owner, {
      type: "workflow",
      name: "Pedir motivo",
      module: moduleEntityType(colab.id),
      config: { trigger: { event: "before_save" }, conditions: { match: "all", conditions: [{ field: estado, op: "changed_to", value: "Rechazada" }] }, actions: [{ type: "require_fields", fields: [motivo] }] },
    });
    const r = await createRecord(B, colab.id, OWNER, { title: "Para rechazar" });
    const err = await updateRecord(B, colab.id, r.id, { values: { [field("estado").id]: "Rechazada" } }, OWNER).catch((e) => e);
    expect(err).toBeInstanceOf(AutomationRequirementError);
    expect(err.requirement.fields[0].bodyPath).toEqual(["values", field("motivo_rechazo").id]);
    const value = await prisma.customFieldValue.findFirst({ where: { definitionId: field("estado").id, entityId: r.id } });
    expect(value?.value).toBe("Pendiente"); // no se guardó nada
    await updateRecord(B, colab.id, r.id, { values: { [field("estado").id]: "Rechazada", [field("motivo_rechazo").id]: "No cumple requisitos" } }, OWNER);
    expect((await prisma.customFieldValue.findFirst({ where: { definitionId: field("estado").id, entityId: r.id } }))?.value).toBe("Rechazada");
    expect(await prisma.automationRun.count({ where: { businessId: B, status: "blocked" } })).toBe(1);
  });

  it("al cambiar el teléfono de un contacto, actualiza sus colaboraciones (acción sobre relacionados) y lo registra", async () => {
    const c = await createContact(B, { name: "Con teléfono", phone: "1" });
    const rec = await createRecord(B, colab.id, OWNER, { title: "Vinculada", values: { [field("contacto").id]: c.id } });
    await createRule(B, owner, {
      type: "workflow",
      name: "Copiar teléfono",
      module: "contact",
      config: {
        trigger: { event: "updated", field: "phone" },
        conditions: { match: "all", conditions: [] },
        actions: [{ type: "update_related", via: `in:${field("contacto").id}`, field: customFieldKey(field("observaciones").id), valueFrom: "phone" }],
      },
    });
    await updateContact(B, c.id, { phone: "999" }, OWNER);
    const obs = await prisma.customFieldValue.findFirst({ where: { definitionId: field("observaciones").id, entityId: rec.id } });
    expect(obs?.value).toBe("999");
    const run = await prisma.automationRun.findFirst({ where: { businessId: B, rule: { name: "Copiar teléfono" } } });
    expect(run?.status).toBe("success");
  });

  it("sin ciclos: una regla que se modifica a sí misma corre una vez por cadena", async () => {
    const def = await createCustomFieldDefinition(B, { entityType: "lead", key: "contador", label: "Contador", type: "text" });
    await createRule(B, owner, {
      type: "workflow",
      name: "Auto-loop",
      module: "lead",
      config: { trigger: { event: "updated" }, conditions: { match: "all", conditions: [] }, actions: [{ type: "set_field", field: customFieldKey(def.id), value: "x" }] },
    });
    const lead = await createLead(B, { name: "Loop" });
    await updateLead(B, lead.id, { name: "Loop 2" }, OWNER);
    const runs = await prisma.automationRun.findMany({ where: { businessId: B, rule: { name: "Auto-loop" } } });
    expect(runs.filter((r) => r.status === "success")).toHaveLength(1);
    expect(runs.some((r) => r.status === "skipped" && r.depth === 1)).toBe(true);
  });
});

describe("permisos y equipos", () => {
  it("vendedor con alcance «propios» solo ve sus leads; con excepción puede eliminar", async () => {
    await createLead(B, { name: "De S1", ownerId: SELLER });
    await createLead(B, { name: "De S2", ownerId: SELLER2 });
    await setMemberAccess(B, owner, SELLER, { overrides: { modules: { lead: { scope: "own", delete: true } } } });
    const access = await resolveAccess(B, SELLER, "member");
    const visible = await listLeads(B, { scope: scopeWhere(access, "lead") });
    expect(visible.map((l) => l.name)).toEqual(["De S1"]);
    expect(access.policy.modules.lead.delete).toBe(true);
    expect(access.policy.modules["*"].delete).toBe(false);
  });

  it("alcance «equipo» con jerarquía: el responsable ve los sub-equipos", async () => {
    const dir = await createTeam(B, owner, { name: "Dirección", leadUserId: OWNER });
    const ventas = await createTeam(B, owner, { name: "Ventas", memberIds: [SELLER, SELLER2] });
    await updateTeam(B, owner, ventas.id, { parentId: dir.id });
    await expect(updateTeam(B, owner, dir.id, { parentId: ventas.id })).rejects.toThrow("team_cycle");
    await setMemberAccess(B, owner, SELLER, { overrides: { modules: { lead: { scope: "team" } } } });
    const access = await resolveAccess(B, SELLER, "member");
    expect((await listLeads(B, { scope: scopeWhere(access, "lead") })).map((l) => l.name).sort()).toEqual(["De S1", "De S2"]);
  });
});

describe("informes y preferencias", () => {
  it("panel: cantidad agrupada por estado en un módulo personalizado", async () => {
    const access = await resolveAccess(B, OWNER, "owner");
    const data = await computeWidgets(B, access, [
      { id: "w1", type: "bar", title: "Por estado", module: moduleEntityType(colab.id), metric: { op: "count" }, groupBy: customFieldKey(field("estado").id), dateField: "createdAt", period: "all", filters: { match: "all", conditions: [] }, columns: [], limit: 10, size: 1 },
      { id: "w2", type: "metric", title: "Total", module: "lead", metric: { op: "count" }, dateField: "createdAt", period: "30", filters: { match: "all", conditions: [] }, columns: [], limit: 10, size: 1 },
    ]);
    expect(data.w1.kind).toBe("bar");
    if (data.w1.kind === "bar") expect(data.w1.rows.find((r) => r.label === "Rechazada")?.value).toBe(1);
    expect(data.w2.kind === "metric" && data.w2.value).toBeGreaterThanOrEqual(3);
  });

  it("guarda y lee la última vista de una lista por usuario", async () => {
    await setPreference(B, SELLER, "list:opportunity", "display=list&sort=amount");
    expect(await getPreference(B, SELLER, "list:opportunity")).toBe("display=list&sort=amount");
    expect(await getPreference(B, OWNER, "list:opportunity")).toBeNull();
    await expect(setPreference(B, SELLER, "otra:cosa", "x")).rejects.toThrow();
  });
});
