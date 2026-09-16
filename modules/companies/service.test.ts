import { describe, expect, it, vi, beforeEach } from "vitest";

const companyCreate = vi.fn();
const companyFindMany = vi.fn();
const companyFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      create: (...args: unknown[]) => companyCreate(...args),
      findMany: (...args: unknown[]) => companyFindMany(...args),
      findFirst: (...args: unknown[]) => companyFindFirst(...args),
    },
  },
}));

const { createCompany, listCompanies, getCompany } = await import("./service");

beforeEach(() => {
  companyCreate.mockReset();
  companyFindMany.mockReset();
  companyFindFirst.mockReset();
});

describe("createCompany", () => {
  it("crea una Company con el businessId recibido y status 'prospect' por default", async () => {
    companyCreate.mockResolvedValue({ id: "co_1" });

    await createCompany("biz_1", { name: "Ferretería Centro" });

    expect(companyCreate).toHaveBeenCalledWith({
      data: {
        businessId: "biz_1",
        name: "Ferretería Centro",
        domain: null,
        phone: null,
        status: "prospect",
        ownerId: null,
      },
    });
  });
});

describe("listCompanies / getCompany — aislamiento multi-tenant", () => {
  it("listCompanies siempre filtra por businessId", async () => {
    companyFindMany.mockResolvedValue([]);

    await listCompanies("biz_A");

    expect(companyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: "biz_A" } })
    );
  });

  it("getCompany exige coincidencia de businessId ademas del id (un Workspace no puede leer una Company de otro)", async () => {
    companyFindFirst.mockResolvedValue(null);

    await getCompany("biz_A", "co_de_biz_B");

    expect(companyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "co_de_biz_B", businessId: "biz_A" } })
    );
  });
});
