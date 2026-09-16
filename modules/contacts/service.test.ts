import { describe, expect, it, vi, beforeEach } from "vitest";

const contactCreate = vi.fn();
const contactFindMany = vi.fn();
const contactFindFirst = vi.fn();
const contactUpdateMany = vi.fn();
const companyFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: {
      create: (...args: unknown[]) => contactCreate(...args),
      findMany: (...args: unknown[]) => contactFindMany(...args),
      findFirst: (...args: unknown[]) => contactFindFirst(...args),
      updateMany: (...args: unknown[]) => contactUpdateMany(...args),
    },
    company: {
      findFirst: (...args: unknown[]) => companyFindFirst(...args),
    },
  },
}));

const { createContact, listContacts, getContact, updateContact } = await import("./service");

beforeEach(() => {
  contactCreate.mockReset();
  contactFindMany.mockReset();
  contactFindFirst.mockReset();
  contactUpdateMany.mockReset();
  companyFindFirst.mockReset();
});

describe("createContact", () => {
  it("crea el contacto con el businessId recibido", async () => {
    contactCreate.mockResolvedValue({ id: "ct_1" });
    await createContact("biz_1", { name: "Ana" });
    expect(contactCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ businessId: "biz_1", name: "Ana" }) })
    );
  });

  it("relación con Company: valida que la Company sea del MISMO businessId antes de crear", async () => {
    companyFindFirst.mockResolvedValue(null); // Company de otro negocio o inexistente
    await expect(createContact("biz_1", { name: "Ana", companyId: "co_de_otro_negocio" })).rejects.toThrow(
      "company_not_found"
    );
    expect(companyFindFirst).toHaveBeenCalledWith({
      where: { id: "co_de_otro_negocio", businessId: "biz_1" },
      select: { id: true },
    });
    expect(contactCreate).not.toHaveBeenCalled();
  });

  it("relación con Company: crea normalmente si la Company sí es del mismo negocio", async () => {
    companyFindFirst.mockResolvedValue({ id: "co_1" });
    contactCreate.mockResolvedValue({ id: "ct_2" });
    await createContact("biz_1", { name: "Ana", companyId: "co_1" });
    expect(contactCreate).toHaveBeenCalled();
  });
});

describe("aislamiento multi-tenant", () => {
  it("listContacts siempre filtra por businessId", async () => {
    contactFindMany.mockResolvedValue([]);
    await listContacts("biz_A");
    expect(contactFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: "biz_A" }) }));
  });

  it("getContact exige coincidencia de businessId, no solo de id", async () => {
    contactFindFirst.mockResolvedValue(null);
    await getContact("biz_A", "ct_de_biz_B");
    expect(contactFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ct_de_biz_B", businessId: "biz_A" } })
    );
  });

  it("updateContact usa updateMany con businessId en el where (un id de otro negocio no matchea ninguna fila)", async () => {
    contactUpdateMany.mockResolvedValue({ count: 0 });
    const result = await updateContact("biz_A", "ct_de_biz_B", { name: "Otro nombre" });
    expect(contactUpdateMany).toHaveBeenCalledWith({ where: { id: "ct_de_biz_B", businessId: "biz_A" }, data: { name: "Otro nombre" } });
    expect(result).toBeNull();
  });
});
