"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { CALENDAR_EVENT_TYPE_LABELS } from "@/lib/labels";
import { toInstant } from "@/lib/calendar-dates";

interface Option {
  id: string;
  name: string;
}

export interface EventFormValues {
  title: string;
  description: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  ownerId: string;
  companyId: string;
  contactId: string;
  leadId: string;
  opportunityId: string;
}

interface Conflict {
  id: string;
  title: string;
}

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_not_connected: "Conectá Google Calendar en Configuración → Integraciones para usar esta opción.",
  google_needs_reconnect: "Google revocó el acceso. Reconectá Google Calendar en Configuración → Integraciones.",
  google_event_forbidden: "Este evento está en el Google Calendar de otra persona: solo ella puede modificarlo.",
  google_sync_failed: "No pudimos actualizar Google Calendar. No se guardó ningún cambio; probá de nuevo.",
};

export function EventForm({
  initial,
  eventId,
  members,
  companies,
  contacts,
  leads,
  opportunities,
  returnTo,
  googleCalendarConnected = false,
  googleLinked = false,
}: {
  initial?: Partial<EventFormValues>;
  eventId?: string;
  members: { userId: string; name: string; email: string }[];
  companies: Option[];
  contacts: Option[];
  leads: Option[];
  opportunities: Option[];
  returnTo?: string;
  // Google conectado con permiso de Calendar: habilita crear el evento también allá.
  googleCalendarConnected?: boolean;
  // El evento ya vive en Google: los cambios de título/horario/lugar se reflejan allá.
  googleLinked?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<EventFormValues>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    type: initial?.type ?? "meeting",
    date: initial?.date ?? "",
    startTime: initial?.startTime ?? "10:00",
    endTime: initial?.endTime ?? "11:00",
    location: initial?.location ?? "",
    ownerId: initial?.ownerId ?? "",
    companyId: initial?.companyId ?? "",
    contactId: initial?.contactId ?? "",
    leadId: initial?.leadId ?? "",
    opportunityId: initial?.opportunityId ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [syncToGoogle, setSyncToGoogle] = useState(false);

  const rangeValid = !!values.date && !!values.startTime && !!values.endTime && values.endTime > values.startTime;

  useEffect(() => {
    if (!rangeValid || !values.ownerId) {
      setConflicts([]);
      return;
    }
    const controller = new AbortController();
    const qs = new URLSearchParams({
      ownerId: values.ownerId,
      startsAt: toInstant(values.date, values.startTime).toISOString(),
      endsAt: toInstant(values.date, values.endTime).toISOString(),
    });
    if (eventId) qs.set("excludeId", eventId);
    fetch(`/api/calendar/conflicts?${qs}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then(setConflicts)
      .catch(() => {});
    return () => controller.abort();
  }, [rangeValid, values.ownerId, values.date, values.startTime, values.endTime, eventId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rangeValid) {
      setError("La hora de fin debe ser posterior a la de inicio.");
      return;
    }
    setLoading(true);

    const res = await fetch(eventId ? `/api/calendar/events/${eventId}` : "/api/calendar/events", {
      method: eventId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: values.title,
        description: values.description || null,
        type: values.type,
        startsAt: toInstant(values.date, values.startTime).toISOString(),
        endsAt: toInstant(values.date, values.endTime).toISOString(),
        location: values.location || null,
        ownerId: values.ownerId || null,
        companyId: values.companyId || null,
        contactId: values.contactId || null,
        leadId: values.leadId || null,
        opportunityId: values.opportunityId || null,
        ...(!eventId && syncToGoogle ? { syncToGoogle: true } : {}),
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(GOOGLE_ERROR_MESSAGES[body?.error ?? ""] ?? "Revisá los datos e intentá de nuevo.");
      return;
    }
    router.push(returnTo ?? "/dashboard/calendario");
    router.refresh();
  }

  const set = (patch: Partial<EventFormValues>) => setValues((v) => ({ ...v, ...patch }));

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <div>
        <Label htmlFor="title">Título *</Label>
        <Input id="title" required value={values.title} onChange={(e) => set({ title: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <Label htmlFor="type">Tipo</Label>
          <Select id="type" value={values.type} onChange={(e) => set({ type: e.target.value })}>
            {Object.entries(CALENDAR_EVENT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="date">Fecha *</Label>
          <Input id="date" type="date" required value={values.date} onChange={(e) => set({ date: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="startTime">Inicio *</Label>
          <Input id="startTime" type="time" required value={values.startTime} onChange={(e) => set({ startTime: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="endTime">Fin *</Label>
          <Input id="endTime" type="time" required value={values.endTime} onChange={(e) => set({ endTime: e.target.value })} />
        </div>
      </div>

      {values.date && values.endTime <= values.startTime && (
        <p className="text-sm text-red-600">La hora de fin debe ser posterior a la de inicio.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ownerId">Responsable</Label>
          <Select id="ownerId" value={values.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>
            <option value="">Sin asignar</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name || m.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="location">Ubicación</Label>
          <Input id="location" value={values.location} onChange={(e) => set({ location: e.target.value })} placeholder="Opcional" />
        </div>
      </div>

      {conflicts.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Ya existe otro evento asignado a este responsable en ese horario: {conflicts.map((c) => c.title).join(", ")}. Podés guardarlo igual.
        </p>
      )}

      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" rows={3} value={values.description} onChange={(e) => set({ description: e.target.value })} />
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Relacionado con</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <RelationSelect id="companyId" label="Empresa" empty="Ninguna" value={values.companyId} options={companies} onChange={(v) => set({ companyId: v })} />
          <RelationSelect id="contactId" label="Contacto" empty="Ninguno" value={values.contactId} options={contacts} onChange={(v) => set({ contactId: v })} />
          <RelationSelect id="leadId" label="Lead" empty="Ninguno" value={values.leadId} options={leads} onChange={(v) => set({ leadId: v })} />
          <RelationSelect id="opportunityId" label="Oportunidad" empty="Ninguna" value={values.opportunityId} options={opportunities} onChange={(v) => set({ opportunityId: v })} />
        </div>
      </div>

      {!eventId && googleCalendarConnected && (
        <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={syncToGoogle} onChange={(e) => setSyncToGoogle(e.target.checked)} />
          <span>
            Crear también en mi Google Calendar
            <span className="block text-xs text-slate-500">Se agrega al calendario principal de tu cuenta de Google.</span>
          </span>
        </label>
      )}
      {eventId && googleLinked && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          Este evento también está en Google Calendar: los cambios de título, descripción, lugar y horario se reflejan allá.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Guardando…" : eventId ? "Guardar cambios" : "Programar"}
      </Button>
    </form>
  );
}

function RelationSelect({
  id,
  label,
  empty,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  empty: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
