"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Label, Select } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";

interface Stage {
  id: string;
  label: string;
}
interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
}
interface ContactOption {
  id: string;
  name: string;
}
interface Member {
  userId: string;
  name: string;
  email: string;
}
interface PossibleContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: { id: string; name: string } | null;
}

type Step = 1 | 2 | 3;

// Wizard de 3 pasos, no más (pedido explícito: "no hacer un wizard de 10
// pasos") — Contacto -> Oportunidad -> Resumen. Ver
// docs/architecture/crm-fase5-lead-conversion.md, "UI del Lead".
export function ConvertLeadAction({
  leadId,
  leadName,
  contacts,
  pipelines,
  members,
}: {
  leadId: string;
  leadName: string;
  contacts: ContactOption[];
  pipelines: Pipeline[];
  members: Member[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [possibleContacts, setPossibleContacts] = useState<PossibleContact[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [contactMode, setContactMode] = useState<"new" | "existing">("new");
  const [contactId, setContactId] = useState("");

  const [createOpportunity, setCreateOpportunity] = useState(true);
  const [title, setTitle] = useState(`${leadName} — Oportunidad`);
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const [stageId, setStageId] = useState(pipelines[0]?.stages[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState("");
  const [amount, setAmount] = useState("");

  const stages = useMemo(() => pipelines.find((p) => p.id === pipelineId)?.stages ?? [], [pipelines, pipelineId]);

  useEffect(() => {
    if (!open) return;
    setLoadingSuggestions(true);
    fetch(`/api/leads/${leadId}/possible-contacts`)
      .then((res) => (res.ok ? res.json() : []))
      .then((matches: PossibleContact[]) => {
        setPossibleContacts(matches);
        if (matches.length > 0) {
          setContactMode("existing");
          setContactId(matches[0].id);
        }
      })
      .finally(() => setLoadingSuggestions(false));
  }, [open, leadId]);

  function openWizard() {
    setStep(1);
    setError(null);
    setOpen(true);
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    const body = {
      contact: contactMode === "existing" ? { mode: "existing" as const, contactId } : { mode: "new" as const },
      createOpportunity,
      opportunity: createOpportunity
        ? {
            title,
            pipelineId,
            stageId,
            ownerId: ownerId || null,
            amount: amount ? Number(amount) : null,
          }
        : undefined,
    };

    const res = await fetch(`/api/leads/${leadId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.error === "lead_already_converted") {
        setOpen(false);
        router.refresh();
        return;
      }
      setError("No pudimos completar la conversión. Revisá los datos e intentá de nuevo.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  const canGoToStep2 = contactMode === "new" || !!contactId;
  const canConfirm = !createOpportunity || (!!title.trim() && !!pipelineId && !!stageId);

  return (
    <>
      <Button onClick={openWizard}>Convertir Lead</Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Convertir Lead">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Paso 1 de 3 — Contacto</p>

            {loadingSuggestions && <p className="text-xs text-slate-400">Buscando posibles contactos existentes…</p>}
            {!loadingSuggestions && possibleContacts.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium">Posible contacto existente</p>
                <p className="mt-0.5 text-xs">
                  Encontramos {possibleContacts.length === 1 ? "un contacto" : "contactos"} con el mismo email o teléfono.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  checked={contactMode === "new"}
                  onChange={() => setContactMode("new")}
                  className="h-4 w-4 accent-indigo-600"
                />
                Crear nuevo contacto
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  checked={contactMode === "existing"}
                  onChange={() => setContactMode("existing")}
                  className="h-4 w-4 accent-indigo-600"
                />
                Usar contacto existente
              </label>
            </div>

            {contactMode === "existing" && (
              <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">Elegí un contacto…</option>
                {possibleContacts.length > 0 && (
                  <optgroup label="Posibles coincidencias">
                    {possibleContacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.email ? `· ${c.email}` : c.phone ? `· ${c.phone}` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Todos los contactos">
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              </Select>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!canGoToStep2} onClick={() => setStep(2)}>
                Siguiente
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Paso 2 de 3 — Oportunidad</p>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={createOpportunity}
                onChange={(e) => setCreateOpportunity(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              Crear oportunidad
            </label>

            {createOpportunity && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div>
                  <Label htmlFor="convert-title">Nombre *</Label>
                  <Input id="convert-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="convert-pipeline">Pipeline *</Label>
                    <Select
                      id="convert-pipeline"
                      value={pipelineId}
                      onChange={(e) => {
                        const next = e.target.value;
                        setPipelineId(next);
                        setStageId(pipelines.find((p) => p.id === next)?.stages[0]?.id ?? "");
                      }}
                    >
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="convert-stage">Etapa inicial *</Label>
                    <Select id="convert-stage" value={stageId} onChange={(e) => setStageId(e.target.value)}>
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="convert-owner">Responsable</Label>
                    <Select id="convert-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                      <option value="">Sin asignar</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name || m.email}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="convert-amount">Valor</Label>
                    <Input id="convert-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Atrás
              </Button>
              <Button disabled={!canConfirm} onClick={() => setStep(3)}>
                Siguiente
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Paso 3 de 3 — Resumen</p>

            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Lead</dt>
                <dd className="text-slate-900">{leadName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Contacto</dt>
                <dd className="text-slate-900">
                  {contactMode === "new" ? `Se creará: ${leadName}` : (contacts.find((c) => c.id === contactId)?.name ?? possibleContacts.find((c) => c.id === contactId)?.name ?? "—")}
                </dd>
              </div>
              {createOpportunity && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Oportunidad</dt>
                  <dd className="text-slate-900">{title || "—"}</dd>
                </div>
              )}
            </dl>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setStep(2)} disabled={loading}>
                Atrás
              </Button>
              <Button onClick={handleConfirm} disabled={loading}>
                {loading ? "Convirtiendo…" : "Convertir"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
