"use client";

import { useMemo, useState } from "react";

import { Button, Card, Input, Label, Select } from "@/components/ui/primitives";
import { RecordPicker, type PickedRecord } from "@/components/custom-modules/record-picker";
import { CHANGE_OPERATORS, LIST_OPERATORS, OPERATOR_LABELS, VALUELESS_OPERATORS, operatorsFor, type FieldMeta } from "@/lib/entities";
import {
  ACTION_LABELS,
  BEFORE_SAVE_ACTIONS,
  WORKFLOW_EVENTS,
  WORKFLOW_EVENT_HINTS,
  WORKFLOW_EVENT_LABELS,
  type WorkflowAction,
  type WorkflowCondition,
  type WorkflowConditionGroup,
  type WorkflowConfig,
  type WorkflowEvent,
} from "@/modules/automations/workflow-config";

export interface BuilderModule {
  entityType: string;
  singular: string;
  plural: string;
  href?: string;
  fields: FieldMeta[];
}
export interface BuilderMeta {
  modules: BuilderModule[];
  related: Record<string, { via: string; label: string; target: string }[]>;
  members: { userId: string; name: string; role: string }[];
}

export interface WorkflowDraft {
  id?: string;
  name: string;
  module: string;
  config: WorkflowConfig;
}

type GroupItem = WorkflowConditionGroup["conditions"][number];
type SubGroup = { match: "all" | "any"; conditions: WorkflowCondition[] };

const emptyConfig = (): WorkflowConfig => ({
  trigger: { event: "updated", field: null },
  conditions: { match: "all", conditions: [] },
  actions: [{ type: "notify", recipients: "owner", title: "Cambio en {{nombre}}", message: null }],
  stopOnError: true,
});

function defaultAction(type: WorkflowAction["type"], fields: FieldMeta[]): WorkflowAction {
  const writable = fields.find((f) => f.writable && f.key !== "ownerId");
  switch (type) {
    case "require_fields":
      return { type, fields: [], message: null };
    case "block":
      return { type, message: "Este cambio no está permitido." };
    case "set_field":
      return { type, field: writable?.key ?? "", value: null, valueFrom: null };
    case "assign_owner":
      return { type, mode: "fixed", userIds: [], onlyIfUnassigned: false };
    case "create_task":
      return { type, title: "Seguimiento de {{nombre}}", dueInDays: 1, assignTo: "record_owner", userId: null, priority: "medium" };
    case "notify":
      return { type, recipients: "owner", title: "Cambio en {{nombre}}", message: null };
    case "add_note":
      return { type, body: "" };
    case "update_related":
      return { type, via: "", field: "", value: null, valueFrom: null };
  }
}

/**
 * Constructor de automatizaciones genéricas: módulo → disparador →
 * condiciones (AND/OR, con un nivel de subgrupos) → acciones encadenadas.
 * Solo arma la configuración: el servidor la valida contra el módulo real
 * al guardar (validateWorkflow) y la vuelve a validar al ejecutar.
 */
export function WorkflowBuilder({
  meta,
  initial,
  saving,
  error,
  onCancel,
  onSave,
}: {
  meta: BuilderMeta;
  initial?: WorkflowDraft;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (draft: WorkflowDraft) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [module, setModule] = useState(initial?.module ?? meta.modules[0]?.entityType ?? "lead");
  const [config, setConfig] = useState<WorkflowConfig>(initial?.config ?? emptyConfig());
  const mod = meta.modules.find((m) => m.entityType === module);
  const fields = useMemo(() => mod?.fields ?? [], [mod]);
  const fieldMap = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const event = config.trigger.event;
  const allowChange = event === "updated" || event === "created_or_updated" || event === "before_save";
  const beforeSave = event === "before_save";

  function setEvent(ev: WorkflowEvent) {
    // Las acciones válidas dependen del disparador: se reemplazan las que ya no aplican.
    const actions = config.actions.filter((a) => (ev === "before_save" ? BEFORE_SAVE_ACTIONS.has(a.type) : !BEFORE_SAVE_ACTIONS.has(a.type)));
    setConfig({
      ...config,
      trigger: { event: ev, field: ev === "deleted" || ev === "created" ? null : config.trigger.field },
      actions: actions.length ? actions : [defaultAction(ev === "before_save" ? "require_fields" : "notify", fields)],
    });
  }

  function changeModule(next: string) {
    setModule(next);
    const nextFields = meta.modules.find((m) => m.entityType === next)?.fields ?? [];
    setConfig({
      ...config,
      trigger: { ...config.trigger, field: null },
      conditions: { match: config.conditions.match, conditions: [] },
      actions: [defaultAction(beforeSave ? "require_fields" : "notify", nextFields)],
    });
  }

  const setActions = (actions: WorkflowAction[]) => setConfig({ ...config, actions });
  const availableActions = (Object.keys(ACTION_LABELS) as WorkflowAction["type"][]).filter((t) =>
    beforeSave ? BEFORE_SAVE_ACTIONS.has(t) : !BEFORE_SAVE_ACTIONS.has(t) && !(event === "deleted" && ["set_field", "assign_owner", "add_note"].includes(t))
  );

  return (
    <Card className="space-y-5 p-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="wf-name">Nombre de la automatización</Label>
          <Input id="wf-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ej: Pedir motivo al rechazar" />
        </div>
        <div>
          <Label htmlFor="wf-module">Módulo</Label>
          <Select id="wf-module" value={module} onChange={(e) => changeModule(e.target.value)} disabled={!!initial?.id}>
            {meta.modules.map((m) => (
              <option key={m.entityType} value={m.entityType}>
                {m.plural}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="wf-event">Cuándo</Label>
          <Select id="wf-event" value={event} onChange={(e) => setEvent(e.target.value as WorkflowEvent)}>
            {WORKFLOW_EVENTS.map((ev) => (
              <option key={ev} value={ev}>
                {WORKFLOW_EVENT_LABELS[ev]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p className="-mt-2 text-xs text-slate-500">{WORKFLOW_EVENT_HINTS[event]}</p>

      {allowChange && (
        <div className="max-w-md">
          <Label htmlFor="wf-field">Solo si cambia el campo (opcional)</Label>
          <Select id="wf-field" value={config.trigger.field ?? ""} onChange={(e) => setConfig({ ...config, trigger: { ...config.trigger, field: e.target.value || null } })}>
            <option value="">Cualquier cambio</option>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Condiciones</h3>
          <MatchToggle value={config.conditions.match} onChange={(match) => setConfig({ ...config, conditions: { ...config.conditions, match } })} />
          <span className="text-xs text-slate-500">Sin condiciones, corre siempre.</span>
        </div>
        <ConditionList
          items={config.conditions.conditions}
          fields={fields}
          fieldMap={fieldMap}
          meta={meta}
          allowChange={allowChange}
          allowGroups
          onChange={(conditions) => setConfig({ ...config, conditions: { ...config.conditions, conditions } })}
        />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Acciones (en orden)</h3>
        <ol className="space-y-3">
          {config.actions.map((a, i) => (
            <li key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{i + 1}</span>
                <Select
                  aria-label="Tipo de acción"
                  value={a.type}
                  onChange={(e) => setActions(config.actions.map((x, j) => (j === i ? defaultAction(e.target.value as WorkflowAction["type"], fields) : x)))}
                  className="w-auto"
                >
                  {availableActions.map((t) => (
                    <option key={t} value={t}>
                      {ACTION_LABELS[t]}
                    </option>
                  ))}
                </Select>
                <div className="ml-auto flex gap-1">
                  <Button type="button" size="sm" variant="ghost" disabled={i === 0} onClick={() => setActions(swap(config.actions, i, i - 1))} aria-label="Subir acción">
                    ▲
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={i === config.actions.length - 1} onClick={() => setActions(swap(config.actions, i, i + 1))} aria-label="Bajar acción">
                    ▼
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="text-red-600" disabled={config.actions.length === 1} onClick={() => setActions(config.actions.filter((_, j) => j !== i))}>
                    Quitar
                  </Button>
                </div>
              </div>
              <ActionEditor action={a} fields={fields} fieldMap={fieldMap} meta={meta} module={module} onChange={(next) => setActions(config.actions.map((x, j) => (j === i ? next : x)))} />
            </li>
          ))}
        </ol>
        {config.actions.length < 10 && (
          <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => setActions([...config.actions, defaultAction(availableActions[0], fields)])}>
            Agregar acción
          </Button>
        )}
        {!beforeSave && (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={config.stopOnError} onChange={(e) => setConfig({ ...config, stopOnError: e.target.checked })} />
            Si una acción falla, no ejecutar las siguientes
          </label>
        )}
        <p className="mt-2 text-xs text-slate-500">
          En títulos y mensajes podés usar <code>{"{{nombre}}"}</code> (nombre del registro) y <code>{"{{modulo}}"}</code>. «Actualizar un campo» y «Actualizar relacionados» pueden disparar otras
          automatizaciones (hasta 3 niveles, sin repetir reglas).
        </p>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" loading={saving} disabled={!name.trim()} onClick={() => onSave({ id: initial?.id, name: name.trim(), module, config })}>
          {initial?.id ? "Guardar cambios" : "Crear automatización"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}

function swap<T>(list: T[], i: number, j: number) {
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function MatchToggle({ value, onChange }: { value: "all" | "any"; onChange: (v: "all" | "any") => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs" role="group" aria-label="Combinar condiciones">
      {(["all", "any"] as const).map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)} aria-pressed={value === m} className={`rounded-md px-2 py-1 font-medium ${value === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
          {m === "all" ? "Todas (Y)" : "Alguna (O)"}
        </button>
      ))}
    </div>
  );
}

export function ConditionList({
  items,
  fields,
  fieldMap,
  meta,
  allowChange,
  allowGroups,
  onChange,
}: {
  items: GroupItem[];
  fields: FieldMeta[];
  fieldMap: Map<string, FieldMeta>;
  meta: BuilderMeta;
  allowChange: boolean;
  allowGroups: boolean;
  onChange: (items: GroupItem[]) => void;
}) {
  const newCondition = (): WorkflowCondition => {
    const f = fields[0];
    return { field: f?.key ?? "", op: f ? operatorsFor(f.type)[0] : "equals", value: null };
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) =>
        "conditions" in item ? (
          <div key={i} className="rounded-xl border border-dashed border-slate-300 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Grupo:</span>
              <MatchToggle value={item.match} onChange={(match) => onChange(items.map((x, j) => (j === i ? { ...(x as SubGroup), match } : x)))} />
              <Button type="button" size="sm" variant="ghost" className="ml-auto text-red-600" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                Quitar grupo
              </Button>
            </div>
            <ConditionList
              items={item.conditions}
              fields={fields}
              fieldMap={fieldMap}
              meta={meta}
              allowChange={allowChange}
              allowGroups={false}
              onChange={(conditions) => onChange(items.map((x, j) => (j === i ? { ...(x as SubGroup), conditions: conditions as WorkflowCondition[] } : x)))}
            />
          </div>
        ) : (
          <ConditionRow
            key={i}
            condition={item}
            fields={fields}
            fieldMap={fieldMap}
            meta={meta}
            allowChange={allowChange}
            onChange={(c) => onChange(items.map((x, j) => (j === i ? c : x)))}
            onRemove={() => onChange(items.filter((_, j) => j !== i))}
          />
        )
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={items.length >= 20 || fields.length === 0} onClick={() => onChange([...items, newCondition()])}>
          Agregar condición
        </Button>
        {allowGroups && (
          <Button type="button" size="sm" variant="ghost" disabled={items.length >= 20} onClick={() => onChange([...items, { match: "any", conditions: [newCondition()] }])}>
            Agregar grupo
          </Button>
        )}
      </div>
    </div>
  );
}

function ConditionRow({
  condition,
  fields,
  fieldMap,
  meta,
  allowChange,
  onChange,
  onRemove,
}: {
  condition: WorkflowCondition;
  fields: FieldMeta[];
  fieldMap: Map<string, FieldMeta>;
  meta: BuilderMeta;
  allowChange: boolean;
  onChange: (c: WorkflowCondition) => void;
  onRemove: () => void;
}) {
  const field = fieldMap.get(condition.field);
  const ops = field ? operatorsFor(field.type).filter((o) => allowChange || !CHANGE_OPERATORS.has(o)) : [];
  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-[minmax(10rem,1fr)_minmax(9rem,auto)_minmax(10rem,1fr)_auto] sm:items-center">
      <Select
        aria-label="Campo"
        value={condition.field}
        onChange={(e) => {
          const f = fieldMap.get(e.target.value);
          onChange({ field: e.target.value, op: f ? operatorsFor(f.type)[0] : "equals", value: null });
        }}
      >
        {!field && <option value={condition.field}>(campo eliminado)</option>}
        {fields.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </Select>
      <Select aria-label="Operador" value={condition.op} onChange={(e) => onChange({ ...condition, op: e.target.value, value: VALUELESS_OPERATORS.has(e.target.value) ? null : condition.value })}>
        {ops.map((o) => (
          <option key={o} value={o}>
            {OPERATOR_LABELS[o] ?? o}
          </option>
        ))}
      </Select>
      {field && !VALUELESS_OPERATORS.has(condition.op) ? (
        <ValueInput meta={field} op={condition.op} value={condition.value ?? ""} members={meta.members} onChange={(value) => onChange({ ...condition, value })} />
      ) : (
        <span />
      )}
      <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={onRemove} aria-label="Quitar condición">
        Quitar
      </Button>
    </div>
  );
}

function ValueInput({
  meta,
  op,
  value,
  members,
  onChange,
}: {
  meta: FieldMeta;
  op?: string;
  value: string;
  members: BuilderMeta["members"];
  onChange: (v: string) => void;
}) {
  const [picked, setPicked] = useState<PickedRecord[]>([]);
  if (op && ["within_last_days", "older_than_days"].includes(op)) {
    return <Input type="number" min={0} aria-label="Días" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Días" />;
  }
  const options = meta.type === "user" ? members.map((m) => ({ value: m.userId, label: m.name })) : meta.type === "boolean" ? [{ value: "true", label: "Sí" }, { value: "false", label: "No" }] : meta.options;
  if (options && options.length && (meta.type === "select" || meta.type === "multiselect" || meta.type === "user" || meta.type === "boolean")) {
    if (op && LIST_OPERATORS.has(op)) {
      const selected = value.split(",").filter(Boolean);
      return (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Valores">
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => onChange((on ? selected.filter((s) => s !== o.value) : [...selected, o.value]).join(","))}
                className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${on ? "bg-brand-50 text-brand-800 ring-brand-300" : "bg-white text-slate-600 ring-slate-200"}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <Select aria-label="Valor" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Elegí…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    );
  }
  if (meta.type === "relation" && meta.target) {
    return (
      <RecordPicker
        id={`v-${meta.key}`}
        targetEntity={meta.target}
        multiple={false}
        value={picked.length ? picked : value ? [{ id: value, label: "Registro elegido" }] : []}
        onChange={(next) => {
          setPicked(next);
          onChange(next[0]?.id ?? "");
        }}
      />
    );
  }
  const type = meta.type === "number" || meta.type === "currency" ? "number" : meta.type === "date" || meta.type === "datetime" ? "date" : "text";
  return <Input type={type} step="any" aria-label="Valor" value={value} onChange={(e) => onChange(e.target.value)} />;
}

function UserMultiSelect({ members, value, onChange }: { members: BuilderMeta["members"]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Usuarios">
      {members.map((m) => {
        const on = value.includes(m.userId);
        return (
          <button
            key={m.userId}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((u) => u !== m.userId) : [...value, m.userId])}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${on ? "bg-brand-50 text-brand-800 ring-brand-300" : "bg-white text-slate-600 ring-slate-200"}`}
          >
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

function FieldValueEditor({
  targetFields,
  sourceFields,
  field,
  value,
  valueFrom,
  members,
  onChange,
}: {
  targetFields: FieldMeta[];
  sourceFields: FieldMeta[];
  field: string;
  value: string | null | undefined;
  valueFrom: string | null | undefined;
  members: BuilderMeta["members"];
  onChange: (next: { field: string; value: string | null; valueFrom: string | null }) => void;
}) {
  const writable = targetFields.filter((f) => f.writable);
  const meta = writable.find((f) => f.key === field);
  const copy = !!valueFrom;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div>
        <Label>Campo a actualizar</Label>
        <Select value={field} onChange={(e) => onChange({ field: e.target.value, value: null, valueFrom: null })}>
          <option value="">Elegí…</option>
          {writable.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Valor</Label>
        <Select value={copy ? "copy" : "fixed"} onChange={(e) => onChange({ field, value: null, valueFrom: e.target.value === "copy" ? (sourceFields[0]?.key ?? null) : null })}>
          <option value="fixed">Valor fijo (vacío = borrar)</option>
          <option value="copy">Copiar de un campo</option>
        </Select>
      </div>
      <div>
        <Label>{copy ? "Copiar de" : "Nuevo valor"}</Label>
        {copy ? (
          <Select value={valueFrom ?? ""} onChange={(e) => onChange({ field, value: null, valueFrom: e.target.value })}>
            {sourceFields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
        ) : meta ? (
          <ValueInput meta={meta} value={value ?? ""} members={members} onChange={(v) => onChange({ field, value: v || null, valueFrom: null })} />
        ) : (
          <Input disabled />
        )}
      </div>
    </div>
  );
}

function ActionEditor({
  action,
  fields,
  fieldMap,
  meta,
  module,
  onChange,
}: {
  action: WorkflowAction;
  fields: FieldMeta[];
  fieldMap: Map<string, FieldMeta>;
  meta: BuilderMeta;
  module: string;
  onChange: (a: WorkflowAction) => void;
}) {
  switch (action.type) {
    case "require_fields":
      return (
        <div className="space-y-2">
          <Label>Campos que tienen que tener valor</Label>
          <div className="flex flex-wrap gap-1.5">
            {fields
              .filter((f) => f.writable)
              .map((f) => {
                const on = action.fields.includes(f.key);
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange({ ...action, fields: on ? action.fields.filter((x) => x !== f.key) : [...action.fields, f.key] })}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${on ? "bg-brand-50 text-brand-800 ring-brand-300" : "bg-white text-slate-600 ring-slate-200"}`}
                  >
                    {f.label}
                  </button>
                );
              })}
          </div>
          <Input aria-label="Mensaje" value={action.message ?? ""} maxLength={200} placeholder="Mensaje (opcional): ej. Indicá el motivo del rechazo" onChange={(e) => onChange({ ...action, message: e.target.value || null })} />
          <p className="text-xs text-slate-500">Al guardar, si falta alguno, Nodo lo pide en un cuadro y no guarda hasta que se complete.</p>
        </div>
      );
    case "block":
      return <Input aria-label="Mensaje" value={action.message} maxLength={200} onChange={(e) => onChange({ ...action, message: e.target.value })} />;
    case "set_field":
      return (
        <FieldValueEditor
          targetFields={fields}
          sourceFields={fields}
          field={action.field}
          value={action.value}
          valueFrom={action.valueFrom}
          members={meta.members}
          onChange={(n) => onChange({ ...action, ...n })}
        />
      );
    case "assign_owner":
      return (
        <div className="space-y-2">
          <Select aria-label="Modo" value={action.mode} onChange={(e) => onChange({ ...action, mode: e.target.value as "fixed" | "round_robin" })} className="w-auto">
            <option value="fixed">Siempre al primero elegido</option>
            <option value="round_robin">Rotativo entre los elegidos</option>
          </Select>
          <UserMultiSelect members={meta.members} value={action.userIds} onChange={(userIds) => onChange({ ...action, userIds })} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={action.onlyIfUnassigned} onChange={(e) => onChange({ ...action, onlyIfUnassigned: e.target.checked })} />
            Solo si no tiene responsable
          </label>
        </div>
      );
    case "create_task":
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label>Título</Label>
            <Input value={action.title} maxLength={160} onChange={(e) => onChange({ ...action, title: e.target.value })} />
          </div>
          <div>
            <Label>Vence en (días)</Label>
            <Input type="number" min={0} max={365} value={action.dueInDays} onChange={(e) => onChange({ ...action, dueInDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })} />
          </div>
          <div>
            <Label>Prioridad</Label>
            <Select value={action.priority} onChange={(e) => onChange({ ...action, priority: e.target.value as typeof action.priority })}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </Select>
          </div>
          <div>
            <Label>Asignar a</Label>
            <Select value={action.assignTo} onChange={(e) => onChange({ ...action, assignTo: e.target.value as typeof action.assignTo })}>
              <option value="record_owner">Responsable del registro</option>
              <option value="actor">Quien hizo el cambio</option>
              <option value="user">Un usuario</option>
            </Select>
          </div>
          {action.assignTo === "user" && (
            <div>
              <Label>Usuario</Label>
              <Select value={action.userId ?? ""} onChange={(e) => onChange({ ...action, userId: e.target.value || null })}>
                <option value="">Elegí…</option>
                {meta.members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      );
    case "notify":
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <Label>A quién</Label>
            <Select value={action.recipients} onChange={(e) => onChange({ ...action, recipients: e.target.value as typeof action.recipients })}>
              <option value="owner">Responsable del registro</option>
              <option value="actor">Quien hizo el cambio</option>
              <option value="admins">Dueños y administradores</option>
              <option value="users">Usuarios elegidos</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Título</Label>
            <Input value={action.title} maxLength={120} onChange={(e) => onChange({ ...action, title: e.target.value })} />
          </div>
          {action.recipients === "users" && (
            <div className="sm:col-span-3">
              <UserMultiSelect members={meta.members} value={action.userIds ?? []} onChange={(userIds) => onChange({ ...action, userIds })} />
            </div>
          )}
          <div className="sm:col-span-3">
            <Label>Mensaje (opcional)</Label>
            <Input value={action.message ?? ""} maxLength={500} onChange={(e) => onChange({ ...action, message: e.target.value || null })} />
          </div>
        </div>
      );
    case "add_note":
      return <Input aria-label="Nota" value={action.body} maxLength={2000} placeholder="Texto de la nota" onChange={(e) => onChange({ ...action, body: e.target.value })} />;
    case "update_related": {
      const paths = meta.related[module] ?? [];
      const path = paths.find((p) => p.via === action.via);
      const targetFields = meta.modules.find((m) => m.entityType === path?.target)?.fields ?? [];
      return (
        <div className="space-y-2">
          <div className="max-w-md">
            <Label>Registros relacionados</Label>
            <Select value={action.via} onChange={(e) => onChange({ ...action, via: e.target.value, field: "", value: null, valueFrom: null })}>
              <option value="">Elegí la relación…</option>
              {paths.map((p) => (
                <option key={p.via} value={p.via}>
                  {p.label}
                </option>
              ))}
            </Select>
            {paths.length === 0 && <p className="mt-1 text-xs text-slate-500">Este módulo todavía no tiene relaciones. Creá un campo de tipo relación.</p>}
          </div>
          {path && (
            <FieldValueEditor
              targetFields={targetFields}
              sourceFields={Array.from(fieldMap.values())}
              field={action.field}
              value={action.value}
              valueFrom={action.valueFrom}
              members={meta.members}
              onChange={(n) => onChange({ ...action, ...n })}
            />
          )}
        </div>
      );
    }
  }
}
