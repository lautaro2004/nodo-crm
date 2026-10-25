"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, InlineAlert, Input, Label, Select } from "@/components/ui/primitives";
import { ZapIcon } from "@/components/ui/icons";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/error-messages";
import { WorkflowBuilder, type BuilderMeta, type WorkflowDraft } from "@/components/automations/workflow-builder";
import { ACTION_LABELS, WORKFLOW_EVENT_LABELS, type WorkflowConfig } from "@/modules/automations/workflow-config";
import { OPERATOR_LABELS } from "@/lib/entities";

interface Option {
  value: string;
  label: string;
}
interface Rule {
  id: string;
  name: string;
  type: string;
  module?: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
}
interface Run {
  id: string;
  ruleId?: string;
  ruleName: string;
  status: string;
  message: string | null;
  entityId: string;
  entityType?: string;
  trigger?: string | null;
  depth?: number;
  details?: { type: string; status: string; message: string }[] | null;
  createdAt: string;
}
type Stats = Record<string, { total: number; errors: number; blocked: number; lastAt: string | null }>;

type RuleType = "assign_lead" | "lead_unattended" | "lead_status_change";

const TYPE_INFO: Record<RuleType, { title: string; hint: string }> = {
  assign_lead: { title: "Asignar leads nuevos", hint: "Reparte automáticamente los leads que entran sin responsable (manuales, importados o de Nexo)." },
  lead_unattended: { title: "Alertar leads sin atención", hint: "Avisa si un lead sigue sin llamada, email, reunión o nota registrada después de N horas. Abrir la ficha no cuenta." },
  lead_status_change: { title: "Acciones por cambio de estado", hint: "Al pasar un lead a un estado: asignar, crear una tarea o avisar al responsable." },
};

const RUN_BADGE: Record<string, "success" | "neutral" | "danger" | "warning"> = { success: "success", skipped: "neutral", error: "danger", running: "warning", blocked: "warning" };
const RUN_LABEL: Record<string, string> = { success: "Ejecutada", skipped: "Omitida", error: "Error", running: "En curso", blocked: "Cambio frenado" };

export function AutomationsManager({
  canManage,
  rules,
  runs,
  members,
  statuses,
  sources,
  meta,
  stats = {},
}: {
  canManage: boolean;
  rules: Rule[];
  runs: Run[];
  members: Option[];
  statuses: Option[];
  sources: Option[];
  meta: BuilderMeta;
  stats?: Stats;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<RuleType | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowDraft | "new" | null>(null);
  const [savingWf, setSavingWf] = useState(false);
  const [wfError, setWfError] = useState<string | null>(null);
  const [runFilter, setRunFilter] = useState<{ ruleId: string; status: string }>({ ruleId: "", status: "" });
  const [openRun, setOpenRun] = useState<string | null>(null);
  const moduleLabel = (entityType?: string | null) => meta.modules.find((m) => m.entityType === entityType)?.plural ?? "módulo eliminado";
  const fieldLabel = (module: string | null | undefined, key: string) => meta.modules.find((m) => m.entityType === module)?.fields.find((f) => f.key === key)?.label ?? "campo eliminado";
  const recordHref = (run: Run) => {
    const mod = meta.modules.find((m) => m.entityType === (run.entityType ?? "lead"));
    if (!mod || run.entityId === "nuevo" || run.trigger === "deleted") return null;
    return mod.href ? `${mod.href}/${run.entityId}` : null;
  };

  async function saveWorkflow(draft: WorkflowDraft) {
    setSavingWf(true);
    setWfError(null);
    const res = await fetch(draft.id ? `/api/automations/${draft.id}` : "/api/automations", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft.id ? { name: draft.name, config: draft.config } : { type: "workflow", name: draft.name, module: draft.module, config: draft.config }),
    }).catch(() => null);
    setSavingWf(false);
    if (!res) return setWfError("Sin conexión. La automatización no se guardó.");
    if (!res.ok) {
      const body = await res.clone().json().catch(() => ({}));
      const zod = body.details?.formErrors?.[0] ?? (Object.values(body.details?.fieldErrors ?? {}).flat()[0] as string | undefined);
      return setWfError(body.message ?? zod ?? (await readApiError(res)));
    }
    toast.success(draft.id ? "Automatización actualizada" : "Automatización creada");
    setWorkflow(null);
    startTransition(() => router.refresh());
  }

  function describeWorkflow(rule: Rule) {
    const c = rule.config as unknown as WorkflowConfig;
    const when = `${moduleLabel(rule.module)} · ${WORKFLOW_EVENT_LABELS[c.trigger?.event] ?? ""}${c.trigger?.field ? ` (si cambia «${fieldLabel(rule.module, c.trigger.field)}»)` : ""}`;
    const conds = (c.conditions?.conditions ?? [])
      .map((x) => ("conditions" in x ? `(${x.conditions.length} condiciones)` : `«${fieldLabel(rule.module, x.field)}» ${OPERATOR_LABELS[x.op] ?? x.op}${x.value ? ` ${x.value}` : ""}`))
      .join(c.conditions?.match === "any" ? " o " : " y ");
    const acts = (c.actions ?? []).map((a) => ACTION_LABELS[a.type]).join(" → ");
    return `${when}${conds ? ` · si ${conds}` : ""} · ${acts}`;
  }
  const visibleRuns = runs.filter((r) => (!runFilter.ruleId || r.ruleId === runFilter.ruleId) && (!runFilter.status || r.status === runFilter.status));

  const memberLabel = (id: unknown) => members.find((m) => m.value === id)?.label ?? "usuario eliminado";
  const statusLabel = (key: unknown) => statuses.find((s) => s.value === key)?.label ?? String(key);

  async function call(url: string, init: RequestInit) {
    setError(null);
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    } catch {
      setError("Sin conexión. El cambio no se guardó.");
      return false;
    }
    if (!res.ok) {
      setError(await readApiError(res));
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  function describe(rule: Rule): string {
    const c = rule.config;
    if (rule.type === "assign_lead") {
      const who = ((c.userIds as string[]) ?? []).map(memberLabel).join(", ");
      const src = (c.sources as string[])?.length ? ` · solo ${(c.sources as string[]).map((s) => sources.find((o) => o.value === s)?.label ?? s).join(", ")}` : "";
      return `${c.mode === "round_robin" ? "Rotativo entre" : "Siempre a"} ${who}${src}`;
    }
    if (rule.type === "lead_unattended") return `Avisa si pasan ${c.hours} h sin seguimiento (al responsable o, si no hay, a dueños/admins)`;
    const parts: string[] = [];
    if (c.assignTo) parts.push(`asignar a ${memberLabel(c.assignTo)}${c.onlyIfUnassigned ? " (si no tiene)" : ""}`);
    const task = c.createTask as { title: string; dueInDays: number } | null;
    if (task) parts.push(`tarea “${task.title}” a ${task.dueInDays} días`);
    if (c.notifyOwner) parts.push("avisar al responsable");
    return `Al pasar a “${statusLabel(c.toStatus)}”${c.fromStatus ? ` desde “${statusLabel(c.fromStatus)}”` : ""}: ${parts.join(", ")}`;
  }

  return (
    <div className="space-y-6">
      {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}
      {!canManage && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Solo los dueños o administradores del espacio pueden crear o modificar reglas. Podés ver las reglas activas y su historial.
        </p>
      )}

      {canManage && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => {
              setCreating(null);
              setWfError(null);
              setWorkflow(workflow === "new" ? null : "new");
            }}
            aria-expanded={workflow === "new"}
            className={`rounded-2xl border p-4 text-left transition-colors ${workflow === "new" ? "border-brand-300 bg-brand-50/60" : "border-slate-200/80 bg-white hover:border-slate-300"}`}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ZapIcon className="h-4 w-4 text-brand-600" />
              Automatización personalizada
            </p>
            <p className="mt-1 text-xs text-slate-500">Cualquier módulo (también los tuyos): cuándo, condiciones Y/O y acciones encadenadas. Ej.: pedir motivo al rechazar.</p>
          </button>
          {(Object.keys(TYPE_INFO) as RuleType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setWorkflow(null);
                setCreating(creating === t ? null : t);
              }}
              aria-expanded={creating === t}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                creating === t ? "border-brand-300 bg-brand-50/60" : "border-slate-200/80 bg-white hover:border-slate-300"
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ZapIcon className="h-4 w-4 text-brand-600" />
                {TYPE_INFO[t].title}
              </p>
              <p className="mt-1 text-xs text-slate-500">{TYPE_INFO[t].hint}</p>
            </button>
          ))}
        </div>
      )}

      {workflow && (
        <WorkflowBuilder
          key={workflow === "new" ? "new" : workflow.id}
          meta={meta}
          initial={workflow === "new" ? undefined : workflow}
          saving={savingWf}
          error={wfError}
          onCancel={() => setWorkflow(null)}
          onSave={saveWorkflow}
        />
      )}

      {creating && (
        <RuleForm
          key={creating}
          type={creating}
          members={members}
          statuses={statuses}
          sources={sources}
          pending={pending}
          onCancel={() => setCreating(null)}
          onSubmit={async (body) => {
            if (await call("/api/automations", { method: "POST", body: JSON.stringify(body) })) setCreating(null);
          }}
        />
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Reglas</h2>
        </div>
        {rules.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Todavía no hay reglas. Elegí un tipo arriba para crear la primera.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                    {r.name}
                    <Badge variant={r.enabled ? "success" : "neutral"}>{r.enabled ? "Activa" : "Pausada"}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{r.type === "workflow" ? describeWorkflow(r) : describe(r)}</p>
                  {stats[r.id] && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      Últimos 30 días: {stats[r.id].total} {stats[r.id].total === 1 ? "ejecución" : "ejecuciones"}
                      {stats[r.id].errors ? ` · ${stats[r.id].errors} con error` : ""}
                      {stats[r.id].blocked ? ` · ${stats[r.id].blocked} cambios frenados` : ""}
                    </p>
                  )}
                </div>
                {canManage && (
                  <>
                    {r.type === "workflow" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setCreating(null);
                          setWfError(null);
                          setWorkflow({ id: r.id, name: r.name, module: r.module ?? "lead", config: r.config as unknown as WorkflowConfig });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Editar
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => call(`/api/automations/${r.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !r.enabled }) })}
                    >
                      {r.enabled ? "Pausar" : "Activar"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={async () => {
                        const ok = await confirm({ title: `¿Borrar la regla “${r.name}”?`, description: "Se borra también su historial.", tone: "danger" });
                        if (ok && (await call(`/api/automations/${r.id}`, { method: "DELETE" }))) toast.success("Regla borrada");
                      }}
                    >
                      Borrar
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Últimas ejecuciones</h2>
              <p className="text-xs text-slate-500">Cada regla corre una sola vez por evento; las omitidas indican que la condición ya no se cumplía al ejecutar.</p>
            </div>
            <div className="flex gap-2">
              <Select aria-label="Filtrar por regla" value={runFilter.ruleId} onChange={(e) => setRunFilter({ ...runFilter, ruleId: e.target.value })} className="h-9 w-auto">
                <option value="">Todas las reglas</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
              <Select aria-label="Filtrar por resultado" value={runFilter.status} onChange={(e) => setRunFilter({ ...runFilter, status: e.target.value })} className="h-9 w-auto">
                <option value="">Todos los resultados</option>
                {Object.entries(RUN_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
        {visibleRuns.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">Sin ejecuciones todavía.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {visibleRuns.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5">
                <span className="w-32 shrink-0 text-xs tabular-nums text-slate-500">
                  {new Date(run.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <Badge variant={RUN_BADGE[run.status] ?? "neutral"}>{RUN_LABEL[run.status] ?? run.status}</Badge>
                <span className="font-medium text-slate-800">{run.ruleName}</span>
                {!!run.depth && <Badge>Encadenada (nivel {run.depth})</Badge>}
                <span className="min-w-0 flex-1 truncate text-slate-600">{run.message}</span>
                {run.details?.length ? (
                  <button type="button" className="text-xs font-medium text-slate-500 hover:text-slate-900" onClick={() => setOpenRun(openRun === run.id ? null : run.id)} aria-expanded={openRun === run.id}>
                    {openRun === run.id ? "Ocultar detalle" : "Detalle"}
                  </button>
                ) : null}
                {recordHref(run) && (
                  <Link href={recordHref(run)!} className="text-xs font-medium text-brand-700 hover:underline">
                    Ver registro
                  </Link>
                )}
                {openRun === run.id && run.details && (
                  <ul className="w-full space-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    {run.details.map((d, i) => (
                      <li key={i} className="flex gap-2">
                        <Badge variant={RUN_BADGE[d.status] ?? "neutral"}>{RUN_LABEL[d.status] ?? d.status}</Badge>
                        <span className="font-medium text-slate-700">{ACTION_LABELS[d.type as keyof typeof ACTION_LABELS] ?? d.type}</span>
                        <span className="text-slate-600">{d.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function RuleForm({
  type,
  members,
  statuses,
  sources,
  pending,
  onCancel,
  onSubmit,
}: {
  type: RuleType;
  members: Option[];
  statuses: Option[];
  sources: Option[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (body: { type: RuleType; name: string; config: Record<string, unknown> }) => void;
}) {
  const [name, setName] = useState(TYPE_INFO[type].title);
  // assign_lead
  const [mode, setMode] = useState<"round_robin" | "fixed">("round_robin");
  const [userIds, setUserIds] = useState<string[]>(members.map((m) => m.value));
  const [srcs, setSrcs] = useState<string[]>([]);
  // lead_unattended
  const [hours, setHours] = useState("24");
  // lead_status_change
  const [toStatus, setToStatus] = useState(statuses[1]?.value ?? statuses[0]?.value ?? "");
  const [fromStatus, setFromStatus] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [onlyIfUnassigned, setOnlyIfUnassigned] = useState(true);
  const [withTask, setWithTask] = useState(true);
  const [taskTitle, setTaskTitle] = useState("Hacer seguimiento");
  const [dueInDays, setDueInDays] = useState("1");
  const [notifyOwner, setNotifyOwner] = useState(true);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let config: Record<string, unknown>;
    if (type === "assign_lead") config = { mode, userIds, sources: srcs };
    else if (type === "lead_unattended") config = { hours: Number.parseInt(hours, 10) || 24 };
    else
      config = {
        toStatus,
        fromStatus: fromStatus || null,
        assignTo: assignTo || null,
        onlyIfUnassigned,
        createTask: withTask ? { title: taskTitle.trim(), dueInDays: Number.parseInt(dueInDays, 10) || 0 } : null,
        notifyOwner,
      };
    onSubmit({ type, name: name.trim(), config });
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="space-y-4 text-sm">
        <div>
          <Label htmlFor="rule-name">Nombre de la regla</Label>
          <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>

        {type === "assign_lead" && (
          <>
            <Row label="Modo">
              <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="w-auto">
                <option value="round_robin">Rotativo (reparte en orden)</option>
                <option value="fixed">Siempre al primero de la lista</option>
              </Select>
            </Row>
            <Row label="Responsables">
              <Checks options={members} selected={userIds} onToggle={(v) => setUserIds(toggle(userIds, v))} />
            </Row>
            <Row label="Solo leads de estos orígenes (opcional)">
              <Checks options={sources} selected={srcs} onToggle={(v) => setSrcs(toggle(srcs, v))} />
            </Row>
          </>
        )}

        {type === "lead_unattended" && (
          <Row label="Avisar después de">
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={720} value={hours} onChange={(e) => setHours(e.target.value)} className="w-24" />
              <span className="text-slate-600">horas sin seguimiento desde que entró el lead</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Requiere el cron <code>/api/cron/process-automations</code> (cada 15–60 min). Cada lead se avisa una sola vez por regla.</p>
          </Row>
        )}

        {type === "lead_status_change" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Row label="Cuando el lead pasa a">
                <Select value={toStatus} onChange={(e) => setToStatus(e.target.value)}>
                  {statuses.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Row>
              <Row label="Desde (opcional)">
                <Select value={fromStatus} onChange={(e) => setFromStatus(e.target.value)}>
                  <option value="">Cualquier estado</option>
                  {statuses.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Row>
            </div>
            <Row label="Asignar a">
              <div className="flex flex-wrap items-center gap-3">
                <Select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-auto min-w-48">
                  <option value="">No cambiar responsable</option>
                  {members.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
                {assignTo && (
                  <label className="flex items-center gap-2 text-slate-700">
                    <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={onlyIfUnassigned} onChange={(e) => setOnlyIfUnassigned(e.target.checked)} />
                    Solo si no tiene responsable
                  </label>
                )}
              </div>
            </Row>
            <Row label="Crear tarea">
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={withTask} onChange={(e) => setWithTask(e.target.checked)} />
                Crear una tarea para el responsable
              </label>
              {withTask && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} maxLength={160} className="min-w-56 flex-1" aria-label="Título de la tarea" />
                  <span className="text-slate-600">vence en</span>
                  <Input type="number" min={0} max={60} value={dueInDays} onChange={(e) => setDueInDays(e.target.value)} className="w-20" aria-label="Días" />
                  <span className="text-slate-600">días</span>
                </div>
              )}
            </Row>
            <label className="flex items-center gap-2 text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={notifyOwner} onChange={(e) => setNotifyOwner(e.target.checked)} />
              Avisar al responsable
            </label>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            Crear regla
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-slate-700">{label}</p>
      {children}
    </div>
  );
}

function Checks({ options, selected, onToggle }: { options: Option[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={selected.includes(o.value)}
          onClick={() => onToggle(o.value)}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
            selected.includes(o.value) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
