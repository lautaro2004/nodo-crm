import Link from "next/link";
import type { ReactNode } from "react";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getLeadReport, getOpportunityReport, parseReportFilters } from "@/modules/reports/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { listPipelines } from "@/modules/pipelines/service";
import { getModuleLabel } from "@/modules/workspace/module-config";
import { Button, Card, Input, PageHeader, Select, StatCard } from "@/components/ui/primitives";
import { DownloadIcon } from "@/components/ui/icons";
import { HBars, TimeBars } from "@/components/reports/charts";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import { stageColorKey } from "@/lib/status-colors";

type SP = Record<string, string | string[] | undefined>;

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const money = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const sp = await searchParams;
  const f = parseReportFilters(sp, ctx.userId);
  const [leads, opps, members, pipelines, moduleLabel] = await Promise.all([
    getLeadReport(ctx.businessId, f),
    getOpportunityReport(ctx.businessId, f),
    listWorkspaceMembers(ctx.businessId),
    listPipelines(ctx.businessId),
    getModuleLabel(ctx.businessId, "opportunity"),
  ]);
  const plural = moduleLabel.labelPlural;

  // Query string vigente (para los CSV): mismo período y filtros.
  const qs = new URLSearchParams({ from: f.fromKey, to: f.toKey });
  if (typeof sp.ownerId === "string" && sp.ownerId) qs.set("ownerId", sp.ownerId);
  if (f.source?.length) qs.set("source", f.source.join(","));
  if (f.pipelineId) qs.set("pipelineId", f.pipelineId);
  const csv = (section: string) => `/api/export/report?section=${section}&${qs.toString()}`;
  const range = typeof sp.range === "string" ? sp.range : sp.from ? "custom" : "30";
  const conversionRate = leads.received ? leads.converted / leads.received : null;

  return (
    <div>
      <PageHeader title="Informes" description={`Del ${f.from.toLocaleDateString("es-AR")} al ${f.to.toLocaleDateString("es-AR")}`} />

      <Card className="mb-6 p-4">
        <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
          <FormField label="Período">
            <Select name="range" defaultValue={range} className="w-44">
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="month">Este mes</option>
              <option value="365">Último año</option>
              <option value="custom">Personalizado</option>
            </Select>
          </FormField>
          <FormField label="Desde">
            <Input type="date" name="from" defaultValue={f.fromKey} className="w-40" />
          </FormField>
          <FormField label="Hasta">
            <Input type="date" name="to" defaultValue={f.toKey} className="w-40" />
          </FormField>
          <FormField label="Responsable">
            <Select name="ownerId" defaultValue={typeof sp.ownerId === "string" ? sp.ownerId : ""} className="w-44">
              <option value="">Todos</option>
              <option value="me">Yo</option>
              <option value="none">Sin asignar</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name || m.email}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Origen">
            <Select name="source" defaultValue={f.source?.[0] ?? ""} className="w-44">
              <option value="">Todos</option>
              {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          {pipelines.length > 1 && (
            <FormField label="Pipeline">
              <Select name="pipelineId" defaultValue={f.pipelineId ?? ""} className="w-44">
                <option value="">Principal</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <Button type="submit">Aplicar</Button>
          <p className="w-full text-xs text-slate-500">Con un período predefinido se ignoran las fechas; elegí “Personalizado” para usarlas.</p>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Leads recibidos" value={leads.received} href={`/dashboard/leads?from=${f.fromKey}&to=${f.toKey}`} />
        <StatCard label="Convertidos" value={`${leads.converted} · ${pct(conversionRate)}`} tone="brand" />
        <StatCard label="Rechazados" value={leads.rejected} />
        <StatCard label="Sin seguimiento" value={leads.noFollowUp} tone="danger" href={`/dashboard/leads?from=${f.fromKey}&to=${f.toKey}&open=1&nofollowup=0`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Section title="Leads recibidos" subtitle={leads.series.unit === "week" ? "Por semana" : "Por día"} csv={csv("leads")} className="lg:col-span-2">
          <TimeBars points={leads.series.points} unit={leads.series.unit} label="Leads recibidos" />
        </Section>
        <Section title="Motivos de rechazo" subtitle={`${leads.rejected} rechazados`} csv={csv("reasons")}>
          <HBars rows={leads.reasons.map((r) => ({ label: r.label, value: r.count }))} empty="Sin leads rechazados en el período." />
        </Section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title="Conversión por origen" subtitle="Convertidos / recibidos" csv={csv("sources")}>
          {leads.bySource.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Sin leads en el período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  <th className="pb-2">Origen</th>
                  <th className="pb-2 text-right">Recibidos</th>
                  <th className="pb-2 text-right">Convertidos</th>
                  <th className="pb-2 text-right">Rechazados</th>
                  <th className="pb-2 text-right">Conversión</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {leads.bySource.map((s) => (
                  <tr key={s.source} className="border-t border-slate-100">
                    <td className="py-2 text-slate-800">{LEAD_SOURCE_LABELS[s.source] ?? s.source}</td>
                    <td className="py-2 text-right">{s.received}</td>
                    <td className="py-2 text-right">{s.converted}</td>
                    <td className="py-2 text-right">{s.rejected}</td>
                    <td className="py-2 text-right font-medium">{pct(s.received ? s.converted / s.received : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
        <Section
          title="Leads sin seguimiento"
          subtitle="Abiertos, sin llamada/email/reunión/nota registrada"
          csv={csv("nofollowup")}
        >
          {leads.noFollowUpLeads.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Todos los leads abiertos tuvieron seguimiento. 👏</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {leads.noFollowUpLeads.slice(0, 8).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/dashboard/leads/${l.id}`} className="truncate font-medium text-slate-800 hover:text-brand-700">
                    {l.name}
                  </Link>
                  <span className="shrink-0 text-xs text-slate-500">entró el {l.createdAt.toLocaleDateString("es-AR")}</span>
                </li>
              ))}
              {leads.noFollowUp > 8 && (
                <li className="pt-2">
                  <Link href={`/dashboard/leads?from=${f.fromKey}&to=${f.toKey}&open=1&nofollowup=0`} className="text-xs font-medium text-brand-700 hover:underline">
                    Ver los {leads.noFollowUp}
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Section>
      </div>

      <h2 className="mt-10 mb-3 text-base font-semibold text-slate-900">
        {plural}
        {opps.pipelineName ? ` — ${opps.pipelineName}` : ""}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Ganadas en el período" value={`${opps.won.count} · ${money(opps.won.amount)}`} />
        <StatCard label="Perdidas en el período" value={`${opps.lost.count} · ${money(opps.lost.amount)}`} />
        <StatCard label="Tasa de cierre" value={pct(opps.winRate)} tone="brand" />
        <StatCard label="Abiertas hoy" value={opps.byStage.reduce((n, s) => n + s.count, 0)} href="/dashboard/oportunidades" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title="Abiertas por etapa" subtitle="Foto actual (no depende del período)" csv={csv("stages")}>
          <HBars
            rows={opps.byStage.map((s) => ({ label: s.label, value: s.count, color: stageColorKey(s), hint: s.amount > 0 ? money(s.amount) : undefined }))}
            empty="No hay oportunidades abiertas."
          />
        </Section>
        <Section title="Ganadas y perdidas" subtitle={opps.closedSeries.won.unit === "week" ? "Por semana de cierre" : "Por día de cierre"} csv={csv("closed")}>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ganadas ({opps.won.count})
          </p>
          <TimeBars points={opps.closedSeries.won.points} unit={opps.closedSeries.won.unit} label="Ganadas" barClass="bg-emerald-500" />
          <p className="mt-4 mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Perdidas ({opps.lost.count})
          </p>
          <TimeBars points={opps.closedSeries.lost.points} unit={opps.closedSeries.lost.unit} label="Perdidas" barClass="bg-red-500" />
        </Section>
      </div>

      <details className="mt-8 rounded-2xl border border-slate-200/80 bg-white/70 p-4 text-sm text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-800">Cómo se calcula</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Las métricas de leads usan los leads <strong>creados</strong> en el período (y los filtros de responsable y origen), con su estado actual.</li>
          <li><strong>Rechazado</strong>: estado marcado como “de rechazo” en Configuración → Estados. El motivo sale del campo obligatorio de esa transición.</li>
          <li><strong>Convertido</strong>: lead convertido en contacto/oportunidad. <strong>Conversión</strong> = convertidos ÷ recibidos.</li>
          <li><strong>Sin seguimiento</strong>: abierto y sin ninguna llamada, email, reunión, nota o actividad completada registrada por una persona. Abrir la ficha no cuenta.</li>
          <li><strong>Ganadas/perdidas</strong>: oportunidades cerradas dentro del período. <strong>Tasa de cierre</strong> = ganadas ÷ (ganadas + perdidas).</li>
          <li>Los CSV usan exactamente los mismos filtros que la pantalla.</li>
        </ul>
      </details>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, subtitle, csv, className = "", children }: { title: string; subtitle?: string; csv?: string; className?: string; children: ReactNode }) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {csv && (
          <a href={csv} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
            <DownloadIcon className="h-3.5 w-3.5" />
            CSV
          </a>
        )}
      </div>
      {children}
    </Card>
  );
}
