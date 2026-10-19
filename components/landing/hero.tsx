import Link from "next/link";

import { LogoMark } from "@/components/ui/logo";

const COLUMNS = [
  {
    stage: "Nuevo",
    dot: "bg-sky-500",
    cards: [
      { title: "Martina Gómez", meta: "WhatsApp · hace 2 min", tag: "Desde Nexo" },
      { title: "Estudio Ruiz", meta: "Formulario web", tag: null },
    ],
  },
  {
    stage: "Propuesta",
    dot: "bg-amber-500",
    cards: [
      { title: "Clínica Sur", meta: "$480.000 · Lucía", tag: null },
      { title: "Café Norte", meta: "$120.000 · Tomás", tag: null },
    ],
  },
  {
    stage: "Negociación",
    dot: "bg-violet-500",
    cards: [{ title: "Grupo Andes", meta: "$1.250.000 · Lucía", tag: null }],
  },
  {
    stage: "Ganada",
    dot: "bg-emerald-500",
    cards: [{ title: "Ferretería Centro", meta: "$310.000 · Tomás", tag: null }],
  },
];

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pt-16 pb-16 sm:px-6 sm:pt-24 sm:pb-24 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(50rem_26rem_at_50%_-10%,rgb(251_110_26/0.14),transparent_70%)]"
      />
      <div className="fade-up mx-auto flex max-w-4xl flex-col items-center text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 shadow-[var(--shadow-card)]">
          <LogoMark className="h-4 w-4" />
          Nodo · el CRM de Kodexa
        </span>
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-5xl md:text-6xl">
          Todos tus clientes y ventas,
          <br className="hidden sm:block" /> en un solo lugar.
        </h1>
        <p className="mt-6 max-w-2xl text-base text-slate-600 sm:text-lg">
          Leads, contactos, oportunidades y el seguimiento de tu equipo, ordenados y a la vista. Las consultas y turnos que llegan por
          Nexo entran solos como leads.
        </p>
        <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/registro"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-6 text-base font-medium text-slate-900 shadow-[0_1px_0_rgb(255_255_255/0.35)_inset,0_8px_24px_-8px_rgb(251_110_26/0.6)] transition-colors hover:bg-brand-400"
          >
            Empezar gratis <span aria-hidden>→</span>
          </Link>
          <a href="#como-funciona" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
            Ver cómo funciona
          </a>
        </div>
        <p className="mt-4 text-sm text-slate-500">Importá tu Excel y empezá a trabajar el mismo día.</p>
      </div>

      {/* Visual: el pipeline de Nodo con un lead que entra desde Nexo. */}
      <div className="fade-up relative mx-auto mt-14 max-w-5xl [animation-delay:150ms]">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-lift)]">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400/70" />
            <span className="h-3 w-3 rounded-full bg-amber-400/70" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
            <span className="ml-3 text-xs font-medium text-slate-500">Ventas · Pipeline</span>
            <span className="ml-auto hidden text-xs text-slate-400 sm:block">$2.160.000 abiertos</span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:p-5 md:grid-cols-4">
            {COLUMNS.map((col, ci) => (
              <div key={col.stage} className={`rounded-xl bg-slate-50 p-2.5 ${ci > 1 ? "hidden md:block" : ""}`}>
                <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  {col.stage}
                  <span className="ml-auto font-normal text-slate-400">{col.cards.length}</span>
                </div>
                <div className="space-y-2">
                  {col.cards.map((card) => (
                    <div
                      key={card.title}
                      className={`rounded-lg border bg-white p-2.5 text-left shadow-[var(--shadow-card)] ${card.tag ? "toast-in border-brand-300 ring-2 ring-brand-500/15" : "border-slate-200/80"}`}
                    >
                      <p className="truncate text-[13px] font-medium text-slate-900">{card.title}</p>
                      <p className="truncate text-[11px] text-slate-500">{card.meta}</p>
                      {card.tag && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">
                          {card.tag}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="toast-in absolute -top-5 right-3 hidden items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-[var(--shadow-lift)] sm:flex">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5Z" />
            </svg>
          </span>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-900">Nuevo lead desde WhatsApp</p>
            <p className="text-[11px] text-slate-500">Nexo lo cargó en Nodo automáticamente</p>
          </div>
        </div>
      </div>
    </section>
  );
}
