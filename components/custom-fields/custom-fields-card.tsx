import Link from "next/link";

import { Card } from "@/components/ui/primitives";
import { CustomFieldsEditor } from "@/components/custom-fields/custom-fields-editor";
import type { CustomFieldWithValue } from "@/modules/custom-fields/service";

// Bloque "Campos personalizados" del detalle de un registro (lead,
// contacto, empresa, oportunidad). Muestra TODAS las definiciones del
// módulo —con o sin valor— para que un campo recién creado (por ejemplo
// desde el importador) se pueda ver y completar enseguida.
export function CustomFieldsCard({
  entityId,
  fields,
  canManage,
}: {
  entityId: string;
  fields: CustomFieldWithValue[];
  canManage: boolean;
}) {
  if (fields.length === 0) return null;
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Campos personalizados</h2>
        {canManage && (
          <Link href="/dashboard/configuracion/campos-personalizados" className="text-xs text-slate-500 hover:text-brand-700">
            Administrar campos
          </Link>
        )}
      </div>
      <CustomFieldsEditor entityId={entityId} fields={fields} />
    </Card>
  );
}
