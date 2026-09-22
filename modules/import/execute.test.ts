import { describe, expect, it, vi, beforeEach } from "vitest";

const contactFindFirst = vi.fn();
const contactCreate = vi.fn();
const contactUpdateMany = vi.fn();
const companyFindFirst = vi.fn();
const companyCreate = vi.fn();
const companyUpdateMany = vi.fn();
const leadFindFirst = vi.fn();
const leadCreate = vi.fn();
const leadUpdateMany = vi.fn();
const activityCreate = vi.fn();
const definitionFindMany = vi.fn();
const definitionFindFirst = vi.fn();
const valueUpsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: {
      findFirst: (...a: unknown[]) => contactFindFirst(...a),
      create: (...a: unknown[]) => contactCreate(...a),
      updateMany: (...a: unknown[]) => contactUpdateMany(...a),
    },
    company: {
      findFirst: (...a: unknown[]) => companyFindFirst(...a),
      create: (...a: unknown[]) => companyCreate(...a),
      updateMany: (...a: unknown[]) => companyUpdateMany(...a),
    },
    lead: {
      findFirst: (...a: unknown[]) => leadFindFirst(...a),
      create: (...a: unknown[]) => leadCreate(...a),
      updateMany: (...a: unknown[]) => leadUpdateMany(...a),
    },
    activity: { create: (...a: unknown[]) => activityCreate(...a) },
    customFieldDefinition: {
      findMany: (...a: unknown[]) => definitionFindMany(...a),
      findFirst: (...a: unknown[]) => definitionFindFirst(...a),
    },
    customFieldValue: { upsert: (...a: unknown[]) => valueUpsert(...a) },
  },
}));

const { executeImport } = await import("./execute");

beforeEach(() => {
  for (const m of [
    contactFindFirst, contactCreate, contactUpdateMany,
    companyFindFirst, companyCreate, companyUpdateMany,
    leadFindFirst, leadCreate, leadUpdateMany, activityCreate,
    definitionFindMany, definitionFindFirst, valueUpsert,
  ])
    m.mockReset();
  definitionFindMany.mockResolvedValue([]);
  contactCreate.mockImplementation(async ({ data }) => ({ id: "c-new", ...data }));
  companyCreate.mockImplementation(async ({ data }) => ({ id: "co-new", ...data }));
  leadCreate.mockImplementation(async ({ data }) => ({ id: "l-new", ...data }));
  activityCreate.mockResolvedValue({});
});

describe("executeImport — creación (contact)", () => {
  it("fila válida crea un contacto con businessId del servidor", async () => {
    contactFindFirst.mockResolvedValue(null);
    const result = await executeImport("biz-a", "contact", [{ standard: { name: "Juan Pérez", email: "juan@x.com" }, custom: {} }]);
    expect(contactCreate.mock.calls[0][0].data).toMatchObject({ businessId: "biz-a", name: "Juan Pérez", email: "juan@x.com" });
    expect(result).toEqual({ totalRows: 1, created: 1, updated: 0, errorCount: 0, errors: [] });
  });

  it("8. registros inválidos: falta el nombre requerido -> no se crea nada, queda reportado", async () => {
    const result = await executeImport("biz-a", "contact", [{ standard: { email: "juan@x.com" }, custom: {} }]);
    expect(contactCreate).not.toHaveBeenCalled();
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]).toMatchObject({ row: 2 });
    expect(result.errors[0].messages[0]).toMatch(/Nombre/);
  });

  it("email con formato inválido queda como error y no crea el registro", async () => {
    const result = await executeImport("biz-a", "contact", [{ standard: { name: "Juan", email: "no-es-email" }, custom: {} }]);
    expect(contactCreate).not.toHaveBeenCalled();
    expect(result.errors[0].messages[0]).toMatch(/válido/);
  });
});

describe("executeImport — duplicados (Fase 6)", () => {
  it("11. si existe un contacto con el mismo email, actualiza en vez de duplicar", async () => {
    contactFindFirst.mockResolvedValueOnce({ id: "c-existing", email: "juan@x.com" });
    const result = await executeImport("biz-a", "contact", [{ standard: { name: "Juan Nuevo", email: "juan@x.com" }, custom: {} }]);
    expect(contactCreate).not.toHaveBeenCalled();
    expect(contactUpdateMany).toHaveBeenCalledWith({ where: { id: "c-existing", businessId: "biz-a" }, data: { name: "Juan Nuevo", email: "juan@x.com" } });
    expect(result).toMatchObject({ created: 0, updated: 1 });
  });

  it("busca primero por email y sólo si no hay email intenta por teléfono", async () => {
    contactFindFirst.mockResolvedValueOnce(null); // email
    contactFindFirst.mockResolvedValueOnce({ id: "c-by-phone" }); // phone
    await executeImport("biz-a", "contact", [{ standard: { name: "Juan", email: "juan@x.com", phone: "123" }, custom: {} }]);
    expect(contactFindFirst).toHaveBeenCalledTimes(2);
    expect(contactUpdateMany.mock.calls[0][0].where.id).toBe("c-by-phone");
  });

  it("sin ningún identificador (sin email ni teléfono) SIEMPRE crea — no hay forma segura de deduplicar", async () => {
    const result = await executeImport("biz-a", "contact", [{ standard: { name: "Juan" }, custom: {} }]);
    expect(contactFindFirst).not.toHaveBeenCalled();
    expect(contactCreate).toHaveBeenCalled();
    expect(result.created).toBe(1);
  });

  it("company deduplica por dominio, nunca por nombre", async () => {
    companyFindFirst.mockResolvedValueOnce({ id: "co-existing" });
    const result = await executeImport("biz-a", "company", [{ standard: { name: "Acme", domain: "acme.com" }, custom: {} }]);
    expect(companyFindFirst).toHaveBeenCalledWith({ where: { businessId: "biz-a", domain: { equals: "acme.com", mode: "insensitive" } } });
    expect(result.updated).toBe(1);
  });

  it("una fila sin identificador no dispara ninguna búsqueda por nombre", async () => {
    await executeImport("biz-a", "company", [{ standard: { name: "Acme Duplicada" }, custom: {} }]);
    expect(companyFindFirst).not.toHaveBeenCalled();
    expect(companyCreate).toHaveBeenCalled();
  });
});

describe("executeImport — custom fields durante la importación", () => {
  it("6/7. escribe el valor sólo si el definitionId es autoritativo (existe en este negocio+entidad)", async () => {
    contactFindFirst.mockResolvedValue(null);
    definitionFindMany.mockResolvedValue([{ id: "def-sena", businessId: "biz-a", entityType: "contact", key: "sena", label: "Seña", type: "currency", options: [], required: false, order: 0 }]);
    definitionFindFirst.mockResolvedValue({ id: "def-sena", businessId: "biz-a" });
    valueUpsert.mockResolvedValue({});

    const result = await executeImport("biz-a", "contact", [{ standard: { name: "Juan" }, custom: { "def-sena": "1500" } }]);

    expect(valueUpsert.mock.calls[0][0]).toMatchObject({ create: { definitionId: "def-sena", entityId: "c-new", value: "1500" } });
    expect(result.created).toBe(1);
    expect(result.errorCount).toBe(0);
  });

  it("9. un definitionId inexistente/ajeno (id manipulado) NUNCA se escribe, y la fila queda como error", async () => {
    definitionFindMany.mockResolvedValue([]); // ninguna definición pertenece a este negocio
    const result = await executeImport("biz-a", "contact", [{ standard: { name: "Juan" }, custom: { "def-de-otro-negocio": "1500" } }]);
    expect(valueUpsert).not.toHaveBeenCalled();
    expect(contactCreate).not.toHaveBeenCalled();
    expect(result.errorCount).toBe(1);
  });

  it("7. tipo de custom field inválido (ej. texto en un campo numérico) reporta error y no guarda", async () => {
    definitionFindMany.mockResolvedValue([{ id: "def-sena", type: "number", options: [], label: "Seña" }]);
    const result = await executeImport("biz-a", "contact", [{ standard: { name: "Juan" }, custom: { "def-sena": "no-es-numero" } }]);
    expect(valueUpsert).not.toHaveBeenCalled();
    expect(contactCreate).not.toHaveBeenCalled();
    expect(result.errors[0].messages[0]).toMatch(/número/);
  });
});

describe("executeImport — aislamiento entre Workspaces", () => {
  it("10. la búsqueda de duplicados y la lectura de definiciones quedan SIEMPRE acotadas al businessId del actor", async () => {
    contactFindFirst.mockResolvedValue(null);
    await executeImport("biz-b", "contact", [{ standard: { name: "Ana", email: "ana@x.com" }, custom: {} }]);
    expect(contactFindFirst.mock.calls[0][0].where.businessId).toBe("biz-b");
    expect(definitionFindMany.mock.calls[0][0].where.businessId).toBe("biz-b");
    expect(contactCreate.mock.calls[0][0].data.businessId).toBe("biz-b");
  });
});

describe("executeImport — resultado / importación parcial (Fase 7)", () => {
  it("12/13. procesa el archivo completo aunque algunas filas fallen: creadas + actualizadas + errores sin abortar el resto", async () => {
    // fila 1 (índice 0): pasa la validación pero falla al escribir en la base.
    // fila 2 (índice 1): inválida (sin nombre) — nunca llega a tocar la base.
    // fila 3 (índice 2): duplicado por email -> actualiza en vez de crear.
    contactCreate.mockRejectedValueOnce(new Error("boom"));
    contactFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "existing" });

    const rows: Parameters<typeof executeImport>[2] = [
      { standard: { name: "Falla al guardar", email: "a@x.com" }, custom: {} },
      { standard: { email: "sin-nombre@x.com" }, custom: {} },
      { standard: { name: "Actualiza", email: "b@x.com" }, custom: {} },
    ];

    const result = await executeImport("biz-a", "contact", rows);

    expect(result.totalRows).toBe(3);
    expect(result.updated).toBe(1);
    expect(result.errorCount).toBe(2);
    expect(result.errors.map((e) => e.row)).toEqual([2, 3]);
  });
});
