import { prisma } from "@/lib/prisma";

// Planes con Nodo que se pueden contratar hoy (los administra el superadmin
// de Nexo). Solo lectura. Solo activos, con precio y con usuarios definidos:
// nunca se muestra un plan a medio configurar.
export interface CrmPlanOption {
  id: string;
  name: string;
  description: string | null;
  users: number;
  currency: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  extraUserMonthlyPrice: number | null;
  extraUserYearlyPrice: number | null;
  trialDays: number | null;
  // true si incluye también Nexo (pack).
  includesNexo: boolean;
}

export async function listCrmPlans(): Promise<CrmPlanOption[]> {
  const plans = await prisma.nexoPlan.findMany({
    where: { active: true, products: { has: "crm" } },
    include: { prices: { where: { active: true } } },
    orderBy: [{ displayOrder: "asc" }, { monthlyPrice: "asc" }],
  });
  return plans
    .filter((p) => p.crmMaxUsers && (p.monthlyPrice > 0 || p.prices.some((x) => x.interval === "year")))
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      users: p.crmMaxUsers!,
      currency: p.currency,
      monthlyPrice: p.monthlyPrice > 0 ? p.monthlyPrice : null,
      yearlyPrice: p.prices.find((x) => x.interval === "year")?.amount ?? null,
      extraUserMonthlyPrice: p.extraUserMonthlyPrice,
      extraUserYearlyPrice: p.extraUserYearlyPrice,
      trialDays: p.trialDays,
      includesNexo: p.products.includes("nexo"),
    }));
}
