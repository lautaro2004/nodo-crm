"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Label, Select } from "@/components/ui/primitives";
import { COMPANY_STATUS_LABELS } from "@/lib/labels";

interface CompanyFormValues {
  name: string;
  domain: string;
  phone: string;
  status: string;
}

export function CompanyForm({
  initial,
  companyId,
}: {
  initial?: Partial<CompanyFormValues>;
  companyId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<CompanyFormValues>({
    name: initial?.name ?? "",
    domain: initial?.domain ?? "",
    phone: initial?.phone ?? "",
    status: initial?.status ?? "prospect",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const url = companyId ? `/api/companies/${companyId}` : "/api/companies";
    const method = companyId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setLoading(false);
    if (!res.ok) {
      setError("Revisá los datos e intentá de nuevo.");
      return;
    }
    const saved = await res.json();
    router.push(`/dashboard/empresas/${saved.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <Label htmlFor="name">Nombre *</Label>
        <Input id="name" required value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="domain">Sitio / dominio</Label>
        <Input id="domain" value={values.domain} onChange={(e) => setValues({ ...values, domain: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="status">Estado</Label>
        <Select id="status" value={values.status} onChange={(e) => setValues({ ...values, status: e.target.value })}>
          {Object.entries(COMPANY_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Guardando…" : companyId ? "Guardar cambios" : "Crear empresa"}
      </Button>
    </form>
  );
}
