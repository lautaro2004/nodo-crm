import { requireWorkspace, forbidden } from "@/lib/api-guard";
import { can, scopeWhere } from "@/modules/access/service";
import { csvResponse, toCsv } from "@/lib/csv";
import { LEAD_SOURCE_LABELS, OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";
import { getLeadReport, getOpportunityReport, parseReportFilters } from "@/modules/reports/service";
import { findStatusOption, listStatusOptions } from "@/modules/status-definitions/service";
import { listWorkspaceMembers } from "@/modules/business/members";

// CSV de cada sección de Informes, con los mismos filtros de la pantalla.
export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const sp = new URL(request.url).searchParams;
  const f = { ...parseReportFilters(sp, ctx.userId), scopes: { lead: scopeWhere(ctx.access, "lead"), opportunity: scopeWhere(ctx.access, "opportunity") } };
  const section = sp.get("section") ?? "leads";
  const suffix = `${f.fromKey}_${f.toKey}`;
  const [members, statuses] = await Promise.all([listWorkspaceMembers(ctx.businessId), listStatusOptions(ctx.businessId, "lead")]);
  const owner = (id: string | null) => (id ? (members.find((m) => m.userId === id)?.name ?? "") : "");

  const leadSection = ["leads", "reasons", "sources", "nofollowup"].includes(section);
  if (!can(ctx.access, leadSection ? "lead" : "opportunity", "export")) return forbidden();
  if (leadSection) {
    const r = await getLeadReport(ctx.businessId, f);
    if (section === "reasons") return csvResponse(`motivos-rechazo-${suffix}.csv`, toCsv(["Motivo", "Leads"], r.reasons.map((x) => [x.label, x.count])));
    if (section === "sources")
      return csvResponse(
        `conversion-por-origen-${suffix}.csv`,
        toCsv(
          ["Origen", "Recibidos", "Convertidos", "Rechazados", "Conversión %"],
          r.bySource.map((s) => [LEAD_SOURCE_LABELS[s.source] ?? s.source, s.received, s.converted, s.rejected, s.received ? Math.round((s.converted / s.received) * 100) : 0])
        )
      );
    const noFollowUpIds = new Set(r.noFollowUpLeads.map((l) => l.id));
    if (section === "nofollowup")
      return csvResponse(
        `leads-sin-seguimiento-${suffix}.csv`,
        toCsv(["Lead", "Estado", "Responsable", "Creado"], r.rows.filter((l) => noFollowUpIds.has(l.id)).map((l) => [l.name, findStatusOption(statuses, l.status).label, owner(l.ownerId), l.createdAt]))
      );
    return csvResponse(
      `leads-recibidos-${suffix}.csv`,
      toCsv(
        ["Lead", "Estado", "Motivo", "Origen", "Responsable", "Creado", "Convertido", "Último seguimiento"],
        r.rows.map((l) => [
          l.name,
          findStatusOption(statuses, l.status).label,
          l.statusReason,
          LEAD_SOURCE_LABELS[l.source ?? "manual"] ?? l.source,
          owner(l.ownerId),
          l.createdAt,
          l.convertedAt,
          l.lastFollowUpAt,
        ])
      )
    );
  }

  const o = await getOpportunityReport(ctx.businessId, f);
  if (section === "stages")
    return csvResponse(`oportunidades-por-etapa-${f.toKey}.csv`, toCsv(["Etapa", "Abiertas", "Valor"], o.byStage.map((s) => [s.label, s.count, s.amount])));
  return csvResponse(
    `oportunidades-cerradas-${suffix}.csv`,
    toCsv(
      ["Oportunidad", "Resultado", "Etapa", "Valor", "Responsable", "Cerrada"],
      o.closedRows.map((r) => [r.title, OPPORTUNITY_STATUS_LABELS[r.status] ?? r.status, r.stage.label, r.amount, owner(r.ownerId), r.closedAt])
    )
  );
}
