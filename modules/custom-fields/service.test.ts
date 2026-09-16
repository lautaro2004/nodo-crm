import { describe, expect, it, vi, beforeEach } from "vitest";

const definitionCreate = vi.fn();
const definitionFindFirst = vi.fn();
const definitionFindMany = vi.fn();
const valueUpsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customFieldDefinition: {
      create: (...args: unknown[]) => definitionCreate(...args),
      findFirst: (...args: unknown[]) => definitionFindFirst(...args),
      findMany: (...args: unknown[]) => definitionFindMany(...args),
    },
    customFieldValue: {
      upsert: (...args: unknown[]) => valueUpsert(...args),
    },
  },
}));

const { createCustomFieldDefinition, getCustomFieldsForEntity, setCustomFieldValue } = await import("./service");

beforeEach(() => {
  definitionCreate.mockReset();
  definitionFindFirst.mockReset();
  definitionFindMany.mockReset();
  valueUpsert.mockReset();
});

describe("createCustomFieldDefinition", () => {
  it("crea la definición scopeada al businessId, con options/required/order por default", async () => {
    definitionCreate.mockResolvedValue({ id: "def_1" });
    await createCustomFieldDefinition("biz_1", { entityType: "lead", key: "rubro", label: "Rubro", type: "text" });
    expect(definitionCreate).toHaveBeenCalledWith({
      data: {
        businessId: "biz_1",
        entityType: "lead",
        key: "rubro",
        label: "Rubro",
        type: "text",
        options: [],
        required: false,
        order: 0,
      },
    });
  });
});

describe("setCustomFieldValue — aislamiento", () => {
  it("rechaza (devuelve null) si el definitionId no pertenece al businessId", async () => {
    definitionFindFirst.mockResolvedValue(null); // definición de otro Workspace o inexistente
    const result = await setCustomFieldValue("biz_1", "def_de_otro_negocio", "entity_1", "valor");
    expect(definitionFindFirst).toHaveBeenCalledWith({ where: { id: "def_de_otro_negocio", businessId: "biz_1" } });
    expect(result).toBeNull();
    expect(valueUpsert).not.toHaveBeenCalled();
  });

  it("guarda el valor (upsert) cuando la definición sí pertenece al negocio", async () => {
    definitionFindFirst.mockResolvedValue({ id: "def_1" });
    valueUpsert.mockResolvedValue({ id: "val_1", value: "Software" });

    await setCustomFieldValue("biz_1", "def_1", "lead_1", "Software");

    expect(valueUpsert).toHaveBeenCalledWith({
      where: { definitionId_entityId: { definitionId: "def_1", entityId: "lead_1" } },
      create: { definitionId: "def_1", entityId: "lead_1", value: "Software" },
      update: { value: "Software" },
    });
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
