import type { Metadata } from "next";

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

export default function Home() {
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
        <LandingPlans />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
