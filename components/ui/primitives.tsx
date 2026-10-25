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

// Sistema de diseño propio de Nodo (sin shadcn/radix). Acento naranja
// Kodexa (`brand-*`) sobre neutros cálidos (`slate-*` redefinido en
// app/globals.css). Superficies de trabajo sólidas; el vidrio queda para
// navegación y overlays. La API de cada componente se mantiene estable:
// las páginas existentes no necesitan cambios para adoptar el estilo.

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  /**
   * Operación en curso: muestra un spinner compacto, bloquea nuevos clicks
   * (evita envíos duplicados) y anuncia `aria-busy`. El texto lo decide el
   * caller («Guardar» → «Guardando…»).
   */
  loading?: boolean;
}) {
  // Respuesta inmediata al presionar: leve escala (transform → compositor,
  // sin layout). Se anula con prefers-reduced-motion por la regla global.
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium select-none transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-[var(--ease-out)] active:scale-[0.98] disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 focus-visible:ring-brand-500";
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm" };
  const variants = {
    // Texto grafito sobre naranja: el blanco no alcanza contraste AA (2.9:1).
    primary: "bg-brand-500 text-slate-900 shadow-[0_1px_0_rgb(255_255_255/0.35)_inset,0_1px_2px_rgb(32_33_36/0.12)] hover:bg-brand-400 active:bg-brand-600",
    secondary: "bg-white text-slate-800 border border-slate-200 shadow-[var(--shadow-card)] hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100",
    ghost: "text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900 active:bg-slate-900/[0.08]",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-500 active:bg-red-700",
  };
  return (
    <button
      className={cx(base, sizes[size], variants[variant], loading ? "opacity-80" : "disabled:opacity-50", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className={size === "sm" ? "h-3.5 w-3.5" : undefined} />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)]", className)}>{children}</div>;
}

const BADGE_VARIANTS = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
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
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        BADGE_VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="mb-1.5 block text-[13px] font-medium text-slate-700" {...props} />;
}

const FIELD_BASE =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-[var(--shadow-card)] transition-[border-color,box-shadow] hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-invalid:border-red-400 aria-invalid:focus:ring-red-500/15";

// Si el caller fija un ancho (`w-…`), se omite el `w-full` base: dos
// utilidades de ancho en el mismo elemento dependen del orden del CSS.
function fieldBase(className?: string) {
  return className && /(^|\s)w-/.test(className) ? FIELD_BASE.replace("w-full ", "") : FIELD_BASE;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input className={cx(fieldBase(className), className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea className={cx(fieldBase(className), className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldBase(className), "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2364748b%22><path d=%22M5.5 7.5l4.5 4.5 4.5-4.5%22 stroke=%22%2364748b%22 stroke-width=%221.5%22 fill=%22none%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-8", className)} {...props}>
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
    <div className="mb-6 sm:mb-8">
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
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// Switcher Lista/Kanban reutilizado por Tareas y Oportunidades — mismo
// criterio en las dos pantallas (navega vía query param `?display=`, la
// page como server component decide qué renderizar). No es un componente
// de estado propio: solo arma los dos links.
//
// `defaultView`: la vista que la página muestra SIN `?display=` (Tareas y
// Leads: lista; Oportunidades: Kanban). Antes el link "Lista" siempre
// borraba el parámetro, así que en Oportunidades (default Kanban) la vista
// Lista era inalcanzable desde el toggle.
export function ViewToggle({
  basePath,
  params,
  value,
  defaultView = "list",
}: {
  basePath: string;
  params: URLSearchParams;
  value: "list" | "kanban";
  defaultView?: "list" | "kanban";
}) {
  function hrefFor(display: "list" | "kanban") {
    const next = new URLSearchParams(params);
    if (display === defaultView) next.delete("display");
    else next.set("display", display);
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const base = "inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium transition-colors";
  const active = "bg-white text-slate-900 shadow-[0_1px_2px_rgb(32_33_36/0.08),0_0_0_1px_rgb(32_33_36/0.04)]";
  const inactive = "text-slate-500 hover:text-slate-800";

  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200/80 bg-slate-100/80 p-0.5" role="group" aria-label="Vista">
      <Link href={hrefFor("list")} aria-current={value === "list" ? "page" : undefined} className={cx(base, value === "list" ? active : inactive)}>
        <ListIcon className="h-4 w-4" />
        Lista
      </Link>
      <Link href={hrefFor("kanban")} aria-current={value === "kanban" ? "page" : undefined} className={cx(base, value === "kanban" ? active : inactive)}>
        <KanbanIcon className="h-4 w-4" />
        Kanban
      </Link>
    </div>
  );
}

// Placeholder de carga simple (Next.js loading.tsx) — un bloque gris con
// pulse, sin depender de ninguna librería de skeletons.
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cx("animate-pulse rounded-lg bg-slate-200/60", className)} style={style} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-white/60 px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-200/60">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: "neutral" | "brand" | "danger";
}) {
  const valueTone = tone === "danger" && Number(value) > 0 ? "text-red-600" : tone === "brand" ? "text-brand-700" : "text-slate-900";
  const body = (
    <Card className={cx("h-full p-4 sm:p-5", href && "transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-[var(--shadow-lift)]")}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cx("mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] tabular-nums", valueTone)}>{value}</p>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      {body}
    </Link>
  ) : (
    body
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
      className={cx("whitespace-nowrap bg-slate-50/70 px-3 py-2.5 text-left xl:px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500", className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx("px-3 py-2.5 xl:px-4", className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cx("h-4 w-4 shrink-0 animate-spin text-current", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// Título de sección dentro de una Card de detalle — antes cada página
// repetía `<h2 className="mb-3 text-sm font-semibold ...">` a mano.
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-slate-900">{children}</h2>
      {action}
    </div>
  );
}

// Banner de error inline (guardados fallidos, validaciones del servidor).
export function InlineAlert({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    <div role="alert" className="animate-fade-in mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <span>{children}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 text-red-600 hover:text-red-800" aria-label="Cerrar aviso">
          ×
        </button>
      )}
    </div>
  );
}
