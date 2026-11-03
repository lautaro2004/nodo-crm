import type { Metadata } from "next";

import { listCrmPlans } from "@/modules/billing/plans";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/hero";
import {
  LandingCta,
  LandingFaq,
  LandingFeatures,
  LandingFooter,
  LandingHowItWorks,
  LandingModulesShowcase,
  LandingNexo,
  LandingPains,
  LandingPlans,
} from "@/components/landing/sections";

export const metadata: Metadata = {
  title: "Nodo — el CRM de Kodexa",
  description: "Leads, contactos, oportunidades y el seguimiento de tu equipo en un solo lugar. Conectado con Nexo.",
};

// Los planes salen de la base: se refrescan cada 5 minutos.
export const revalidate = 300;

async function loadPlans() {
  try {
    // Los planes cuyo slug empieza con "test" son para probar el cobro: se
    // pueden contratar desde la pantalla de planes, pero no se publican acá.
    return (await listCrmPlans()).filter((p) => !p.slug.toLowerCase().startsWith("test"));
  } catch (error) {
    console.error("[landing] No se pudieron leer los planes:", error instanceof Error ? error.message : error);
    return [];
  }
}

export default async function Home() {
  const plans = await loadPlans();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <LandingNavbar />
      <main className="flex-1">
        <LandingHero />
        <LandingPains />
        <LandingFeatures />
        <LandingModulesShowcase />
        <LandingHowItWorks />
        <LandingNexo />
        <LandingPlans plans={plans} />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
