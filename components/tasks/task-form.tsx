"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { TASK_PRIORITY_LABELS } from "@/lib/labels";
import { TaskReminderField, type ReminderState } from "@/components/tasks/task-reminder-field";
import { computeRemindAt, guessOffsetKey } from "@/components/tasks/reminder-offsets";

interface Option {
  id: string;
  name: string;
}

interface TaskFormValues {
  title: string;
  description: string;
  priority: string;
  startDate: string;
  dueAt: string;
  ownerId: string;
  companyId: string;
  contactId: string;
  leadId: string;
  opportunityId: string;
}

export function TaskForm({
  initial,
  taskId,
  members,
  companies,
  contacts,
  leads,
  opportunities,
  initialReminder,
}: {
  initial?: Partial<TaskFormValues>;
  taskId?: string;
  members: { userId: string; name: string; email: string }[];
  companies: Option[];
  contacts: Option[];
  leads: Option[];
  opportunities: Option[];
  // remindAt en formato "YYYY-MM-DDTHH:mm" del recordatorio pending existente (edición).
  initialReminder?: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<TaskFormValues>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    priority: initial?.priority ?? "medium",
    startDate: initial?.startDate ?? "",
    dueAt: initial?.dueAt ?? "",
    ownerId: initial?.ownerId ?? "",
    companyId: initial?.companyId ?? "",
    contactId: initial?.contactId ?? "",
    leadId: initial?.leadId ?? "",
    opportunityId: initial?.opportunityId ?? "",
  });
  const [reminder, setReminder] = useState<ReminderState>(() => {
    if (!initialReminder || !initial?.dueAt) return { offset: "none", custom: "" };
    const offset = guessOffsetKey(initial.dueAt, initialReminder);
    return { offset, custom: offset === "custom" ? initialReminder : "" };
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const url = taskId ? `/api/tasks/${taskId}` : "/api/tasks";
    const method = taskId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: values.title,
        description: values.description || null,
        priority: values.priority,
        startDate: values.startDate || null,
        dueAt: values.dueAt || null,
        ownerId: values.ownerId || null,
        companyId: values.companyId || null,
        contactId: values.contactId || null,
        leadId: values.leadId || null,
        opportunityId: values.opportunityId || null,
      }),
    });

    if (!res.ok) {
      setLoading(false);
      setError("Revisá los datos e intentá de nuevo.");
      return;
    }
    const saved = await res.json();

    const remindAt = reminder.offset === "custom" ? reminder.custom : reminder.offset === "none" ? null : computeRemindAt(values.dueAt, Number(reminder.offset));
    if (remindAt) {
      await fetch(`/api/tasks/${saved.id}/reminder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remindAt }),
      });
    } else if (taskId && initialReminder) {
      await fetch(`/api/tasks/${saved.id}/reminder`, { method: "DELETE" });
    }

    setLoading(false);
    router.push(`/dashboard/tareas/${saved.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <div>
        <Label htmlFor="title">Título *</Label>
        <Input id="title" required value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} />
      </div>

      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          rows={4}
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="priority">Prioridad</Label>
          <Select id="priority" value={values.priority} onChange={(e) => setValues({ ...values, priority: e.target.value })}>
            {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="startDate">Inicio</Label>
          <Input id="startDate" type="date" value={values.startDate} onChange={(e) => setValues({ ...values, startDate: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="dueAt">Vencimiento</Label>
          <Input id="dueAt" type="datetime-local" value={values.dueAt} onChange={(e) => setValues({ ...values, dueAt: e.target.value })} />
        </div>
      </div>

      <div>
        <TaskReminderField dueAt={values.dueAt} value={reminder} onChange={setReminder} />
      </div>

      <div>
        <Label htmlFor="ownerId">Responsable</Label>
        <Select id="ownerId" value={values.ownerId} onChange={(e) => setValues({ ...values, ownerId: e.target.value })}>
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name || m.email}
            </option>
          ))}
        </Select>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Relacionado con</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="companyId">Empresa</Label>
            <Select id="companyId" value={values.companyId} onChange={(e) => setValues({ ...values, companyId: e.target.value })}>
              <option value="">Ninguna</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="contactId">Contacto</Label>
            <Select id="contactId" value={values.contactId} onChange={(e) => setValues({ ...values, contactId: e.target.value })}>
              <option value="">Ninguno</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="leadId">Lead</Label>
            <Select id="leadId" value={values.leadId} onChange={(e) => setValues({ ...values, leadId: e.target.value })}>
              <option value="">Ninguno</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="opportunityId">Oportunidad</Label>
            <Select id="opportunityId" value={values.opportunityId} onChange={(e) => setValues({ ...values, opportunityId: e.target.value })}>
              <option value="">Ninguna</option>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Guardando…" : taskId ? "Guardar cambios" : "Crear tarea"}
      </Button>
    </form>
  );
}
