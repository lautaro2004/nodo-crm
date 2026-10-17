import { describe, expect, it, vi, beforeEach } from "vitest";

const definitionCreate = vi.fn();
const definitionFindFirst = vi.fn();
const definitionFindMany = vi.fn();
const valueUpsert = vi.fn();
const valueDeleteMany = vi.fn();
const leadCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customFieldDefinition: {
      create: (...args: unknown[]) => definitionCreate(...args),
      findFirst: (...args: unknown[]) => definitionFindFirst(...args),
      findMany: (...args: unknown[]) => definitionFindMany(...args),
    },
    customFieldValue: {
      upsert: (...args: unknown[]) => valueUpsert(...args),
      deleteMany: (...args: unknown[]) => valueDeleteMany(...args),
    },
    lead: { count: (...args: unknown[]) => leadCount(...args) },
  },
}));

const { createCustomFieldDefinition, getCustomFieldsForEntity, setCustomFieldValue } = await import("./service");

beforeEach(() => {
  definitionCreate.mockReset();
  definitionFindFirst.mockReset();
  definitionFindMany.mockReset();
  valueUpsert.mockReset();
  valueDeleteMany.mockReset();
  leadCount.mockReset();
});

describe("createCustomFieldDefinition", () => {
  it("crea la definición scopeada al businessId, al final del orden", async () => {
    definitionFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ order: 4 });
    definitionCreate.mockResolvedValue({ id: "def_1" });
    const result = await createCustomFieldDefinition("biz_1", { entityType: "lead", key: "rubro", label: "Rubro", type: "text" });
    expect(definitionCreate).toHaveBeenCalledWith({
      data: {
        businessId: "biz_1",
        entityType: "lead",
        key: "rubro",
        label: "Rubro",
        type: "text",
        options: [],
        required: false,
        order: 5,
      },
    });
    expect(result.existing).toBe(false);
  });

  it("si ya existe con el mismo tipo devuelve el existente (no duplica)", async () => {
    definitionFindFirst.mockResolvedValueOnce({ id: "def_viejo", type: "text", label: "Rubro" });
    const result = await createCustomFieldDefinition("biz_1", { entityType: "lead", key: "rubro", label: "Rubro", type: "text" });
    expect(result).toMatchObject({ id: "def_viejo", existing: true });
    expect(definitionCreate).not.toHaveBeenCalled();
  });

  it("si ya existe con otro tipo es un conflicto", async () => {
    definitionFindFirst.mockResolvedValueOnce({ id: "def_viejo", type: "number" });
    await expect(createCustomFieldDefinition("biz_1", { entityType: "lead", key: "rubro", label: "Rubro", type: "text" })).rejects.toThrow(
      "field_key_taken"
    );
  });
});

describe("setCustomFieldValue — aislamiento y normalización", () => {
  it("rechaza si el definitionId no pertenece al businessId", async () => {
    definitionFindFirst.mockResolvedValue(null); // definición de otro Workspace o inexistente
    const result = await setCustomFieldValue("biz_1", "def_de_otro_negocio", "entity_1", "valor");
    expect(definitionFindFirst).toHaveBeenCalledWith({ where: { id: "def_de_otro_negocio", businessId: "biz_1" } });
    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(valueUpsert).not.toHaveBeenCalled();
  });

  it("rechaza si el registro no es de este negocio", async () => {
    definitionFindFirst.mockResolvedValue({ id: "def_1", entityType: "lead", type: "text", options: [], label: "Rubro" });
    leadCount.mockResolvedValue(0);
    const result = await setCustomFieldValue("biz_1", "def_1", "lead_ajeno", "Software");
    expect(leadCount).toHaveBeenCalledWith({ where: { id: "lead_ajeno", businessId: "biz_1" } });
    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(valueUpsert).not.toHaveBeenCalled();
  });

  it("guarda el valor (upsert) cuando definición y registro son del negocio", async () => {
    definitionFindFirst.mockResolvedValue({ id: "def_1", entityType: "lead", type: "text", options: [], label: "Rubro" });
    leadCount.mockResolvedValue(1);
    await setCustomFieldValue("biz_1", "def_1", "lead_1", "Software");
    expect(valueUpsert).toHaveBeenCalledWith({
      where: { definitionId_entityId: { definitionId: "def_1", entityId: "lead_1" } },
      create: { definitionId: "def_1", entityId: "lead_1", value: "Software" },
      update: { value: "Software" },
    });
  });

  it("valida contra el tipo y guarda en forma canónica", async () => {
    definitionFindFirst.mockResolvedValue({ id: "def_f", entityType: "lead", type: "date", options: [], label: "Alta" });
    leadCount.mockResolvedValue(1);
    expect(await setCustomFieldValue("biz_1", "def_f", "lead_1", "31/02/2026")).toMatchObject({ ok: false, error: "invalid_value" });
    expect(await setCustomFieldValue("biz_1", "def_f", "lead_1", "15/03/2026")).toEqual({ ok: true, value: "2026-03-15" });
  });

  it("vacío borra el valor", async () => {
    definitionFindFirst.mockResolvedValue({ id: "def_1", entityType: "lead", type: "text", options: [], label: "Rubro" });
    leadCount.mockResolvedValue(1);
    expect(await setCustomFieldValue("biz_1", "def_1", "lead_1", "")).toEqual({ ok: true, value: null });
    expect(valueDeleteMany).toHaveBeenCalledWith({ where: { definitionId: "def_1", entityId: "lead_1" } });
  });
});

describe("getCustomFieldsForEntity — lectura", () => {
  it("filtra las definiciones por businessId + entityType, y trae el valor de ESA entidad puntual", async () => {
    definitionFindMany.mockResolvedValue([
      { id: "def_1", key: "rubro", label: "Rubro", type: "text", options: [], required: false, values: [{ value: "Software" }] },
      { id: "def_2", key: "empleados", label: "Empleados", type: "number", options: [], required: false, values: [] },
    ]);

    const fields = await getCustomFieldsForEntity("biz_1", "lead", "lead_1");

    expect(definitionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: "biz_1", entityType: "lead" },
        include: { values: { where: { entityId: "lead_1" } } },
      })
    );
    expect(fields).toEqual([
      { definitionId: "def_1", key: "rubro", label: "Rubro", type: "text", options: [], required: false, value: "Software" },
      { definitionId: "def_2", key: "empleados", label: "Empleados", type: "number", options: [], required: false, value: null },
    ]);
  });
});
