"use client";

import { useState } from "react";
import { usePendingNavigation } from "@/lib/hooks/use-pending-navigation";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/error-messages";

import { Button, Input, Label, Select } from "@/components/ui/primitives";

interface CompanyFormValues {
  name: string;
  domain: string;
  phone: string;
  status: string;
}

export function CompanyForm({
  initial,
  companyId,
  statusOptions,
}: {
  initial?: Partial<CompanyFormValues>;
  companyId?: string;
  statusOptions: { key: string; label: string }[];
}) {
  const { navigating, navigate } = usePendingNavigation();
  const toast = useToast();
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
    if (loading || navigating) return;
    setLoading(true);
    setError(null);

    const url = companyId ? `/api/companies/${companyId}` : "/api/companies";
    const method = companyId ? "PATCH" : "POST";
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      setLoading(false);
      setError("Sin conexión. Los cambios no se guardaron.");
      return;
    }

    if (!res.ok) {
      setLoading(false);
      setError(await readApiError(res));
      return;
    }
    const saved = await res.json();
    toast.success(companyId ? "Cambios guardados" : "Empresa creada");
    // El botón sigue en "Guardando…" hasta que llega el detalle (sin dobles envíos).
    navigate(`/dashboard/empresas/${saved.id}`);
    setLoading(false);
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
          {statusOptions.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" loading={loading || navigating}>
        {loading || navigating ? "Guardando…" : companyId ? "Guardar cambios" : "Crear empresa"}
      </Button>
    </form>
  );
}
