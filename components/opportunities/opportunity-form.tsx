"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Label, Select } from "@/components/ui/primitives";

interface Stage {
  id: string;
  key: string;
  label: string;
}
interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
}

interface OpportunityFormValues {
  title: string;
  companyId: string;
  contactId: string;
  pipelineId: string;
  stageId: string;
  amount: string;
}

export function OpportunityForm({
  initial,
  opportunityId,
  pipelines,
  companies,
  contacts,
}: {
  initial?: Partial<OpportunityFormValues>;
  opportunityId?: string;
  pipelines: Pipeline[];
  companies: { id: string; name: string }[];
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const defaultPipeline = initial?.pipelineId ?? pipelines[0]?.id ?? "";
  const [values, setValues] = useState<OpportunityFormValues>({
    title: initial?.title ?? "",
    companyId: initial?.companyId ?? "",
    contactId: initial?.contactId ?? "",
    pipelineId: defaultPipeline,
    stageId: initial?.stageId ?? pipelines.find((p) => p.id === defaultPipeline)?.stages[0]?.id ?? "",
    amount: initial?.amount ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stages = useMemo(() => pipelines.find((p) => p.id === values.pipelineId)?.stages ?? [], [pipelines, values.pipelineId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const url = opportunityId ? `/api/opportunities/${opportunityId}` : "/api/opportunities";
    const method = opportunityId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: values.title,
        companyId: values.companyId || null,
        contactId: values.contactId || null,
        pipelineId: values.pipelineId,
        stageId: values.stageId,
        amount: values.amount ? Number(values.amount) : null,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("Revisá los datos e intentá de nuevo.");
      return;
    }
    const saved = await res.json();
    router.push(`/dashboard/oportunidades/${saved.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <Label htmlFor="title">Título *</Label>
        <Input id="title" required value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="amount">Valor</Label>
        <Input
          id="amount"
          type="number"
          min="0"
          step="0.01"
          value={values.amount}
          onChange={(e) => setValues({ ...values, amount: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="companyId">Empresa</Label>
        <Select id="companyId" value={values.companyId} onChange={(e) => setValues({ ...values, companyId: e.target.value })}>
          <option value="">Sin empresa asociada</option>
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
          <option value="">Sin contacto asociado</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="pipelineId">Pipeline *</Label>
        <Select
          id="pipelineId"
          value={values.pipelineId}
          onChange={(e) => {
            const pipelineId = e.target.value;
            const firstStage = pipelines.find((p) => p.id === pipelineId)?.stages[0]?.id ?? "";
            setValues({ ...values, pipelineId, stageId: firstStage });
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
        <Label htmlFor="stageId">Etapa *</Label>
        <Select id="stageId" value={values.stageId} onChange={(e) => setValues({ ...values, stageId: e.target.value })}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading || !values.pipelineId || !values.stageId}>
        {loading ? "Guardando…" : opportunityId ? "Guardar cambios" : "Crear oportunidad"}
      </Button>
    </form>
  );
}
