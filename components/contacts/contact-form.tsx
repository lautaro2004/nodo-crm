"use client";

import { useState } from "react";
import { usePendingNavigation } from "@/lib/hooks/use-pending-navigation";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/error-messages";

import { Button, Input, Label, Select } from "@/components/ui/primitives";
import { CustomFieldsFormSection, customValuesPayload, initialCustomValues, type FormCustomField } from "@/components/custom-fields/custom-fields-form-section";

interface ContactFormValues {
  name: string;
  email: string;
  phone: string;
  companyId: string;
}

export function ContactForm({
  initial,
  contactId,
  companies,
  customFields,
}: {
  /** Solo en el alta: campos personalizados del módulo (ver CustomFieldsFormSection). */
  customFields?: FormCustomField[];
  initial?: Partial<ContactFormValues>;
  contactId?: string;
  companies: { id: string; name: string }[];
}) {
  const { navigating, navigate } = usePendingNavigation();
  const toast = useToast();
  const [values, setValues] = useState<ContactFormValues>({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    companyId: initial?.companyId ?? "",
  });
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => initialCustomValues(customFields));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || navigating) return;
    setLoading(true);
    setError(null);

    const url = contactId ? `/api/contacts/${contactId}` : "/api/contacts";
    const method = contactId ? "PATCH" : "POST";
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...{ ...values, companyId: values.companyId || null }, ...(customFields?.length ? { customValues: customValuesPayload(customValues) } : {}) }),
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
    toast.success(contactId ? "Cambios guardados" : "Contacto creado");
    // El botón sigue en "Guardando…" hasta que llega el detalle (sin dobles envíos).
    navigate(`/dashboard/contactos/${saved.id}`);
    setLoading(false);
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      {customFields && customFields.length > 0 && <CustomFieldsFormSection fields={customFields} values={customValues} onChange={setCustomValues} />}

      <Button type="submit" loading={loading || navigating}>
        {loading || navigating ? "Guardando…" : contactId ? "Guardar cambios" : "Crear contacto"}
      </Button>
    </form>
  );
}
