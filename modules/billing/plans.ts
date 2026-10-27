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

// ── Combo con Nexo ────────────────────────────────────────────────────────
// Un dueño de Nodo puede sumar un plan de Nexo y pagar un descuento sobre la
// suma de ambos. El combo NO es un plan visible: Nexo lo crea al contratar.
// Acá solo se listan los planes de Nexo "sueltos" que se pueden sumar.
export interface NexoPlanOption {
  id: string;
  name: string;
  monthlyPrice: number;
  currency: string;
}

export async function listNexoPlansForCombo(): Promise<NexoPlanOption[]> {
  const plans = await prisma.nexoPlan.findMany({
    where: { active: true, products: { equals: ["nexo"] }, monthlyPrice: { gt: 0 }, comboDiscountPct: null },
    orderBy: [{ displayOrder: "asc" }, { monthlyPrice: "asc" }],
  });
  return plans.map((p) => ({ id: p.id, name: p.name, monthlyPrice: p.monthlyPrice, currency: p.currency }));
}

/** % de descuento del combo para mostrar (mismo valor que usa Nexo: COMBO_DISCOUNT_PCT). */
export function comboDiscountPercent(): number {
  const raw = Number(process.env.COMBO_DISCOUNT_PCT?.trim());
  return Number.isFinite(raw) && raw > 0 ? Math.min(90, raw) : 20;
}
