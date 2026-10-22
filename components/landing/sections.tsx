import Link from "next/link";
import type { ReactNode } from "react";

import { Logo, LogoMark } from "@/components/ui/logo";
import {
  BarChartIcon,
  BoxIcon,
  CheckSquareIcon,
  KanbanIcon,
  TargetIcon,
  UploadIcon,
  UsersIcon,
  ZapIcon,
} from "@/components/ui/icons";

function SectionHeader({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.025em] text-slate-900 sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-base text-slate-600">{text}</p>}
    </div>
  );
}

// ── Problemas ─────────────────────────────────────────────────────────
const PAINS = [
  { title: "Clientes en un Excel que nadie actualiza", text: "Cada vendedor tiene su planilla y nunca está claro cuál es la versión buena." },
  { title: "Consultas que se pierden en WhatsApp", text: "Alguien preguntó precio hace una semana y nadie le volvió a escribir." },
  { title: "No sabés en qué está cada venta", text: "Para saber cuánto vas a cerrar este mes tenés que preguntarle a cada uno." },
];

export function LandingPains() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <SectionHeader eyebrow="¿Te suena?" title="Vender ya es difícil. Ordenar las ventas no debería serlo." />
      <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
        {PAINS.map((p) => (
          <div key={p.title} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-card)]">
            <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-sm font-semibold text-red-500" aria-hidden>
              ✕
            </span>
            <h3 className="text-base font-semibold text-slate-900">{p.title}</h3>
            <p className="mt-1.5 text-sm text-slate-600">{p.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Funciones ─────────────────────────────────────────────────────────
const FEATURES = [
  { icon: <KanbanIcon />, title: "Pipeline en Kanban o lista", text: "Arrastrá cada oportunidad de etapa. Filtros, columnas y vistas guardadas para cada uno del equipo." },
  { icon: <TargetIcon />, title: "Leads con seguimiento", text: "Estados con colores, último contacto y alertas cuando un lead lleva días sin respuesta." },
  { icon: <CheckSquareIcon />, title: "Tareas y recordatorios", text: "Llamadas, reuniones y pendientes asignados, con recordatorios y Google Calendar." },
  { icon: <ZapIcon />, title: "Automatizaciones", text: "Asigná leads nuevos por turnos, creá tareas al cambiar de estado y avisá cuando algo se estanca." },
  { icon: <BarChartIcon />, title: "Informes claros", text: "Embudo, ventas ganadas, rendimiento por vendedor y origen de los leads. Exportás todo a Excel." },
  { icon: <UsersIcon />, title: "Equipo con roles", text: "Invitá a tu equipo por email o link. Cada uno ve y hace lo que le corresponde según su rol." },
  { icon: <BoxIcon />, title: "Módulos a tu medida", text: "Productos, propiedades, citas o contratos: creá tus propios módulos con los campos que necesites." },
  { icon: <UploadIcon />, title: "Importá tu Excel", text: "Subí tu planilla, Nodo reconoce las columnas y crea los campos que falten. Sin duplicados." },
];

export function LandingFeatures() {
  return (
    <section id="producto" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <SectionHeader
        eyebrow="Producto"
        title="Todo lo que necesita un equipo comercial, sin lo que no usa."
        text="Nodo arranca simple y crece con vos: configurás estados, etapas y campos para tu rubro en minutos."
      />
      <div className="mx-auto mt-12 grid max-w-6xl gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 [&>svg]:h-5 [&>svg]:w-5">
              {f.icon}
            </span>
            <h3 className="mt-4 text-[15px] font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Showcase: productos en oportunidades ──────────────────────────────
const ITEMS = [
  { name: "Taladro percutor 750W", code: "TAL-900", qty: 2, price: 125000, hue: "from-brand-300 to-brand-500" },
  { name: "Amoladora 115 mm", code: "AMO-115", qty: 1, price: 89000, hue: "from-teal-300 to-teal-600" },
  { name: "Set de mechas x20", code: "MEC-020", qty: 3, price: 18500, hue: "from-slate-300 to-slate-500" },
];
const money = (n: number) => `$${n.toLocaleString("es-AR")}`;

export function LandingModulesShowcase() {
  const total = ITEMS.reduce((s, i) => s + i.qty * i.price, 0);
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Módulos propios</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.025em] text-slate-900 sm:text-4xl">Tu catálogo, adentro de cada venta.</h2>
          <p className="mt-4 text-base text-slate-600">
            Armá un módulo de Productos con foto, código y precio, y sumalos a cada oportunidad. Si mañana cambia el precio de lista, las
            ventas que ya cotizaste no se tocan.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-700">
            {[
              "Plantillas listas: productos, citas, propiedades y contratos.",
              "Relacioná registros entre sí: una cita con su contacto, un contrato con su empresa.",
              "Fotos guardadas de forma privada y segura.",
              "Con un clic usás el total de los productos como valor de la oportunidad.",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-600" aria-hidden>
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-lift)] sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Obra Martínez</p>
              <p className="text-xs text-slate-500">Oportunidad · Propuesta</p>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">Abierta</span>
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Productos</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {ITEMS.map((i) => (
              <li key={i.code} className="flex items-center gap-3 px-3 py-2.5">
                <span className={`h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br ${i.hue}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-900">{i.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {i.code} · {i.qty} × {money(i.price)}
                  </p>
                </div>
                <span className="text-[13px] font-medium tabular-nums text-slate-800">{money(i.qty * i.price)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
            <span className="text-slate-500">
              Total de productos <span className="font-semibold tabular-nums text-slate-900">{money(total)}</span>
            </span>
            <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-[var(--shadow-card)]">
              Usar total de productos
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Cómo funciona ─────────────────────────────────────────────────────
const STEPS = [
  { n: "1", title: "Creá tu cuenta y elegí tu rubro", text: "Nodo te propone estados, etapas y campos pensados para tu tipo de negocio. Todo se puede cambiar." },
  { n: "2", title: "Traé tus clientes", text: "Importá tu Excel o CSV, o conectá Nexo para que las consultas de WhatsApp y los turnos entren solos." },
  { n: "3", title: "Sumá a tu equipo y vendé", text: "Invitá a tus vendedores, asigná leads y seguí cada oportunidad hasta cerrarla, con informes al día." },
];

export function LandingHowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <SectionHeader eyebrow="Cómo funciona" title="Funcionando en una tarde." />
      <ol className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="relative rounded-2xl border border-slate-200/80 bg-slate-50/60 p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">{s.n}</span>
            <h3 className="mt-4 text-base font-semibold text-slate-900">{s.title}</h3>
            <p className="mt-1.5 text-sm text-slate-600">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── Con Nexo ──────────────────────────────────────────────────────────
const FLOW = [
  { title: "Un cliente escribe", text: "Por WhatsApp o el sitio de tu negocio.", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { title: "Nexo responde", text: "El asistente atiende, agenda turnos y toma los datos.", tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  { title: "Nodo lo registra", text: "Aparece como lead, con su historial y su responsable.", tone: "bg-brand-50 text-brand-800 ring-brand-200" },
  { title: "Tu equipo cierra", text: "Lo convierten en oportunidad y lo siguen hasta la venta.", tone: "bg-slate-100 text-slate-700 ring-slate-200" },
];

export function LandingNexo() {
  return (
    <section id="nexo" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-slate-900 px-6 py-12 text-white sm:px-10 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">Nodo + Nexo</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">De la consulta a la venta, sin copiar y pegar.</h2>
          <p className="mt-4 text-base text-slate-300">
            Si ya usás Nexo, cada conversación y cada turno llega a Nodo como lead. Misma cuenta, mismo equipo, y el dueño decide quién usa
            cada producto.
          </p>
        </div>
        <ol className="mx-auto mt-10 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((f, i) => (
            <li key={f.title} className="relative rounded-2xl bg-white/[0.06] p-5 ring-1 ring-inset ring-white/10">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${f.tone}`}>Paso {i + 1}</span>
              <h3 className="mt-3 text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-300">{f.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ── Planes ────────────────────────────────────────────────────────────
// Sin precios publicados todavía: se definen aparte. Para mostrarlos,
// completar `price` (texto ya formateado, ej. "$150.000 / mes").
const PLANS: { name: string; price: string | null; highlight: boolean; lines: string[] }[] = [
  {
    name: "Nodo",
    price: null,
    highlight: true,
    lines: ["5 usuarios incluidos", "10 GB para archivos e imágenes", "Contactos y registros sin límite", "Hasta 10 módulos propios", "Soporte por email y WhatsApp"],
  },
  {
    name: "Nodo Plus",
    price: null,
    highlight: false,
    lines: ["10 usuarios incluidos", "25 GB para archivos e imágenes", "Contactos y registros sin límite", "Hasta 20 módulos propios", "Soporte prioritario y ayuda para arrancar"],
  },
];

export function LandingPlans() {
  return (
    <section id="planes" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <SectionHeader
        eyebrow="Planes"
        title="Una suscripción para todo tu equipo."
        text="Sin cobrar por cada usuario. Todas las funciones de Nodo en los dos planes; cambia cuánta gente y cuánto espacio necesitás."
      />
      <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`flex flex-col rounded-2xl border p-6 ${p.highlight ? "border-brand-300 bg-white shadow-[0_24px_48px_-24px_rgb(251_110_26/0.45)] ring-1 ring-brand-200" : "border-slate-200 bg-slate-50/60"}`}
          >
            <div className="flex items-center gap-2">
              <LogoMark className="h-6 w-6" />
              <h3 className="text-lg font-semibold text-slate-900">{p.name}</h3>
              {p.highlight && <span className="ml-auto rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">Recomendado</span>}
            </div>
            {p.price && <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{p.price}</p>}
            <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-700">
              {p.lines.map((l) => (
                <li key={l} className="flex gap-2.5">
                  <span className="text-emerald-600" aria-hidden>
                    ✓
                  </span>
                  {l}
                </li>
              ))}
            </ul>
            <Link
              href="/registro"
              className={`mt-6 inline-flex h-10 items-center justify-center rounded-xl text-sm font-medium ${p.highlight ? "bg-brand-500 text-slate-900 hover:bg-brand-400" : "border border-slate-200 bg-white text-slate-800 hover:border-slate-300"}`}
            >
              Empezar gratis
            </Link>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-xl text-center text-sm text-slate-500">¿Necesitás más usuarios o espacio? Se suman a cualquiera de los dos planes.</p>
    </section>
  );
}

// ── Preguntas frecuentes ──────────────────────────────────────────────
const FAQS = [
  { q: "¿Necesito tener Nexo para usar Nodo?", a: "No. Nodo funciona solo. Si además usás Nexo, las consultas y turnos entran como leads sin que hagas nada." },
  { q: "¿Puedo traer mis clientes desde Excel?", a: "Sí. Subís un .xlsx o .csv, Nodo reconoce las columnas, te deja crear los campos que falten y evita duplicados por email o teléfono." },
  { q: "¿Mis vendedores ven todo?", a: "Vos decidís. Hay roles de dueño, administrador y miembro: los miembros trabajan sus leads y oportunidades, y la configuración queda para el dueño y los administradores." },
  { q: "¿Mis datos están separados de los de otras empresas?", a: "Sí. Cada empresa tiene su espacio aislado, y las imágenes se guardan de forma privada con enlaces temporales." },
  { q: "¿Lo puedo adaptar a mi rubro?", a: "Sí. Cambiás estados, etapas, nombres de módulos y campos, y podés crear módulos propios como productos, propiedades o citas." },
];

export function LandingFaq() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <SectionHeader eyebrow="Preguntas frecuentes" title="Lo que suelen preguntarnos." />
      <div className="mx-auto mt-10 max-w-3xl divide-y divide-slate-200 rounded-2xl border border-slate-200/80 bg-white">
        {FAQS.map((f) => (
          <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-slate-900">
              {f.q}
              <span className="text-slate-400 transition-transform group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ── CTA + footer ──────────────────────────────────────────────────────
export function LandingCta() {
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-3xl border border-brand-200 bg-[radial-gradient(40rem_16rem_at_50%_0%,rgb(251_110_26/0.16),transparent_70%)] bg-white px-6 py-12 text-center shadow-[var(--shadow-card)]">
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.025em] text-slate-900">Ordená tus ventas desde hoy.</h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-slate-600">Creá tu cuenta, importá tus clientes y sumá a tu equipo. Si ya tenés cuenta de Nexo, entrás con la misma.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/registro" className="inline-flex h-11 items-center rounded-xl bg-brand-500 px-6 text-base font-medium text-slate-900 hover:bg-brand-400">
            Empezar gratis
          </Link>
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-200/70 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
        <Logo />
        <div className="flex items-center gap-1.5">
          <span>
            Parte de{" "}
            <a href="https://kodexa.ar" className="font-medium text-slate-700 hover:text-slate-900">
              Kodexa
            </a>
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 sm:items-end">
          <nav aria-label="Legales" className="flex gap-4">
            <Link href="/privacidad" className="hover:text-slate-900">
              Privacidad
            </Link>
            <Link href="/eliminacion-de-datos" className="hover:text-slate-900">
              Eliminación de datos
            </Link>
          </nav>
          <p>© {new Date().getFullYear()} Kodexa</p>
        </div>
      </div>
    </footer>
  );
}
