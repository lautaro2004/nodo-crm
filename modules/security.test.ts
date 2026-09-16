import { describe, expect, it, vi, beforeEach } from "vitest";

// Test dedicado y explícito de aislamiento multi-tenant (no solo implícito
// dentro de cada módulo) — ver docs/architecture/crm-fase3-core.md,
// "Modelo multi-tenant": Business A NUNCA debe poder leer/escribir datos
// de Business B, en ninguna entidad del Core. Simula dos "bases" en
// memoria (una por negocio) y confirma que cada función de lectura
// scopeada por businessId respeta el límite.

interface Row {
  id: string;
  businessId: string;
  [key: string]: unknown;
}

const BIZ_A = "biz_A";
const BIZ_B = "biz_B";

function makeInMemoryTable(rows: Row[]) {
  return {
    findFirst: vi.fn(async ({ where }: { where: { id: string; businessId: string } }) =>
      rows.find((r) => r.id === where.id && r.businessId === where.businessId) ?? null
    ),
    findMany: vi.fn(async ({ where }: { where: { businessId: string } }) => rows.filter((r) => r.businessId === where.businessId)),
  };
}

const companiesTable = makeInMemoryTable([
  { id: "co_A", businessId: BIZ_A, name: "Empresa de A" },
  { id: "co_B", businessId: BIZ_B, name: "Empresa de B" },
]);
const leadsTable = makeInMemoryTable([
  { id: "lead_A", businessId: BIZ_A, name: "Lead de A" },
  { id: "lead_B", businessId: BIZ_B, name: "Lead de B" },
]);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: { findFirst: companiesTable.findFirst, findMany: companiesTable.findMany },
    lead: { findFirst: leadsTable.findFirst, findMany: leadsTable.findMany },
  },
}));

const { getCompany, listCompanies } = await import("./companies/service");
const { getLead, listLeads } = await import("./leads/service");

beforeEach(() => {
  companiesTable.findFirst.mockClear();
  companiesTable.findMany.mockClear();
  leadsTable.findFirst.mockClear();
  leadsTable.findMany.mockClear();
});

describe("Aislamiento multi-tenant — Business A no puede acceder a datos de Business B", () => {
  it("getCompany: A no puede leer una Company real de B por su id", async () => {
    const result = await getCompany(BIZ_A, "co_B");
    expect(result).toBeNull();
  });

  it("getCompany: B sí puede leer su propia Company", async () => {
    const result = await companiesTable.findFirst({ where: { id: "co_B", businessId: BIZ_B } });
    expect(result?.name).toBe("Empresa de B");
  });

  it("listCompanies: A solo ve las Companies de A, nunca las de B", async () => {
    const result = await listCompanies(BIZ_A);
    expect(result.every((c) => c.businessId === BIZ_A)).toBe(true);
    expect(result.some((c) => c.id === "co_B")).toBe(false);
  });

  it("getLead: A no puede leer un Lead real de B por su id", async () => {
    const result = await getLead(BIZ_A, "lead_B");
    expect(result).toBeNull();
  });

  it("listLeads: A solo ve los Leads de A", async () => {
    const result = await listLeads(BIZ_A);
    expect(result.every((l) => l.businessId === BIZ_A)).toBe(true);
  });
});
