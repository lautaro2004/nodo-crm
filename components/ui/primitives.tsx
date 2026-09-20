import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  TableHTMLAttributes,
} from "react";
import Link from "next/link";

import { ChevronLeftIcon, ListIcon, KanbanIcon } from "@/components/ui/icons";

// Sistema de diseño propio de Nodo (sin shadcn/radix instalado — ver
// docs/architecture/crm-fase3-ui.md, "Decisiones de diseño"). Un único
// acento de marca (indigo) sobre una base neutra (slate), 100% clases
// utilitarias de Tailwind v4 — nada de CSS custom más allá de lo mínimo en
// globals.css. La API de cada componente no cambió respecto de la Fase 3:
// esta reescritura es puramente visual, ninguna página que ya los usa
// necesitó tocarse.

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm" };
  const variants = {
    primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500",
    secondary: "bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-500",
  };
  return <button className={cx(base, sizes[size], variants[variant], className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-slate-200/80 bg-white shadow-sm", className)}>{children}</div>;
}

const BADGE_VARIANTS = {
  neutral: "bg-slate-100 text-slate-700",
  brand: "bg-indigo-50 text-indigo-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
};

export function Badge({
  className,
  variant = "neutral",
  children,
}: {
  className?: string;
  variant?: keyof typeof BADGE_VARIANTS;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        BADGE_VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="mb-1.5 block text-sm font-medium text-slate-700" {...props} />;
}

const FIELD_BASE =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(FIELD_BASE, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea className={cx(FIELD_BASE, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(FIELD_BASE, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2364748b%22><path d=%22M5.5 7.5l4.5 4.5 4.5-4.5%22 stroke=%22%2364748b%22 stroke-width=%221.5%22 fill=%22none%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel = "Volver",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-8">
      {backHref && (
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// Switcher Lista/Kanban reutilizado por Tareas y Oportunidades — mismo
// criterio en las dos pantallas (navega vía query param `?display=`, la
// page como server component decide qué renderizar). No es un componente
// de estado propio: solo arma los dos links.
export function ViewToggle({ basePath, params, value }: { basePath: string; params: URLSearchParams; value: "list" | "kanban" }) {
  function hrefFor(display: "list" | "kanban") {
    const next = new URLSearchParams(params);
    if (display === "list") next.delete("display");
    else next.set("display", display);
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const base = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";
  const active = "bg-white text-slate-900 shadow-sm";
  const inactive = "text-slate-500 hover:text-slate-700";

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
      <Link href={hrefFor("list")} className={cx(base, value === "list" ? active : inactive)}>
        <ListIcon className="h-4 w-4" />
        Lista
      </Link>
      <Link href={hrefFor("kanban")} className={cx(base, value === "kanban" ? active : inactive)}>
        <KanbanIcon className="h-4 w-4" />
        Kanban
      </Link>
    </div>
  );
}

// Placeholder de carga simple (Next.js loading.tsx) — un bloque gris con
// pulse, sin depender de ninguna librería de skeletons.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-slate-200/70", className)} />;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-20 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
    </Card>
  );
}

// ── Tabla ─────────────────────────────────────────────────────────────
// Wrapper simple: mantiene los listados existentes (que ya arman su
// propio <table> con estas mismas clases repetidas a mano) consistentes
// entre sí sin imponer un componente de datos genérico.

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cx("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cx("px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500", className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx("px-4 py-3", className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4 w-4 animate-spin text-current", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
