import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/ui/logo";
import { LandingFooter } from "@/components/landing/sections";

// Marco común de las páginas legales (privacidad, eliminación de datos):
// encabezado simple, texto legible y el pie de la landing.
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="glass-bar sticky top-0 z-40 border-b border-slate-200/70">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Nodo, inicio">
            <Logo showTagline={false} />
          </Link>
          <Link href="/login" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
            Iniciar sesión
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Legales</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-slate-900 sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Última actualización: {updated}</p>
        <div className="mt-6 text-base leading-relaxed text-slate-700">{intro}</div>
        <div className="legal-prose mt-10 space-y-10">{children}</div>
      </main>
      <LandingFooter />
    </div>
  );
}

export function LegalSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-700 [&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline-offset-2 hover:[&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-slate-900 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

export const CONTACT_EMAIL = "contacto@kodexa.ar";
