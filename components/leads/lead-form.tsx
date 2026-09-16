"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Label, Select } from "@/components/ui/primitives";

interface LeadFormValues {
  name: string;
  email: string;
  phone: string;
  companyId: string;
  status: string;
}

export function LeadForm({
  initial,
  leadId,
  companies,
  statusOptions,
}: {
  initial?: Partial<LeadFormValues>;
  leadId?: string;
  companies: { id: string; name: string }[];
  statusOptions: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<LeadFormValues>({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    companyId: initial?.companyId ?? "",
    status: initial?.status ?? statusOptions[0]?.key ?? "new",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const url = leadId ? `/api/leads/${leadId}` : "/api/leads";
    const method = leadId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, companyId: values.companyId || null }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("Revisá los datos e intentá de nuevo.");
      return;
    }
    const saved = await res.json();
    router.push(`/dashboard/leads/${saved.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <Label htmlFor="name">Nombre *</Label>
        <Input id="name" required value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} />
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
        <Label htmlFor="status">Estado</Label>
        <Select id="status" value={values.status} onChange={(e) => setValues({ ...values, status: e.target.value })}>
          {statusOptions.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Guardando…" : leadId ? "Guardar cambios" : "Crear lead"}
      </Button>
    </form>
  );
}
