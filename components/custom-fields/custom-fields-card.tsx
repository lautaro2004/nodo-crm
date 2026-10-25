import Link from "next/link";

import { Card } from "@/components/ui/primitives";
import { CustomFieldsEditor } from "@/components/custom-fields/custom-fields-editor";
import type { CustomFieldWithValue } from "@/modules/custom-fields/service";
import { resolveLabels } from "@/modules/records/links";
import { prisma } from "@/lib/prisma";

// Bloque "Campos personalizados" del detalle de un registro (lead,
// contacto, empresa, oportunidad, tarea). Muestra TODAS las definiciones
// del módulo —con o sin valor— para que un campo recién creado (por
// ejemplo desde el importador) se pueda ver y completar enseguida. Los
// campos relación muestran los registros vinculados (nombres reales, no
// texto) y se editan con el buscador de registros.
export async function CustomFieldsCard({
  entityId,
  fields,
  canManage,
  readOnly = false,
}: {
  entityId: string;
  fields: CustomFieldWithValue[];
  canManage: boolean;
  readOnly?: boolean;
}) {
  const visible = fields.filter((f) => f.type !== "image");
  if (visible.length === 0) return null;
  const refs = visible.flatMap((f) => (f.type === "relation" && f.targetEntity && f.value ? f.value.split(",").map((id) => ({ type: f.targetEntity!, id })) : []));
  const businessId = refs.length
    ? (await prisma.customFieldDefinition.findFirst({ where: { id: visible[0].definitionId }, select: { businessId: true } }))?.businessId
    : null;
  const labels = businessId ? await resolveLabels(businessId, refs) : new Map<string, { label: string; href: string }>();
  const relationLabels = Object.fromEntries(Array.from(labels.entries()).map(([k, v]) => [k, v]));

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
      <CustomFieldsEditor entityId={entityId} fields={visible} relationLabels={relationLabels} readOnly={readOnly} />
    </Card>
  );
}
