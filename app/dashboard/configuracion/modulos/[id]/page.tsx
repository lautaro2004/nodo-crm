import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { hasRole } from "@/lib/permissions";
import { AdminOnly } from "@/components/team/admin-only";
import { PageHeader } from "@/components/ui/primitives";
import { getModuleById, listModuleFields, listModules } from "@/modules/custom-modules/service";
import { ModuleSettings } from "@/components/custom-modules/module-settings";
import { ModuleFieldsEditor } from "@/components/custom-modules/module-fields-editor";
import { moduleEntityType, STANDARD_RELATION_TARGETS } from "@/lib/custom-modules";

export default async function ModuleSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!hasRole(ctx.role, "admin")) return <AdminOnly />;

  const { id } = await params;
  const mod = await getModuleById(ctx.businessId, id);
  if (!mod) notFound();
  const [fields, modules] = await Promise.all([listModuleFields(ctx.businessId, id), listModules(ctx.businessId)]);

  const targets = [
    ...STANDARD_RELATION_TARGETS,
    ...modules.filter((m) => m.id !== id).map((m) => ({ value: moduleEntityType(m.id), label: m.labelPlural })),
    { value: moduleEntityType(id), label: `${mod.labelPlural} (este módulo)` },
  ];
  const targetLabel = new Map(targets.map((t) => [t.value, t.label]));

  const fieldRows = fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    options: f.options,
    required: f.required,
    targetEntity: f.targetEntity,
    targetLabel: f.targetEntity ? (targetLabel.get(f.targetEntity) ?? "Módulo archivado") : null,
    multiple: f.multiple,
  }));

  return (
    <div>
      <PageHeader title={mod.labelPlural} description="Datos del módulo, sus campos y qué campo cumple cada rol." backHref="/dashboard/configuracion/modulos" backLabel="Módulos" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ModuleFieldsEditor moduleId={id} entityType={moduleEntityType(id)} fields={fieldRows} targets={targets} />
        </div>
        <div className="lg:col-span-2">
          <ModuleSettings
            module={{
              id: mod.id,
              key: mod.key,
              labelPlural: mod.labelPlural,
              labelSingular: mod.labelSingular,
              description: mod.description,
              icon: mod.icon,
              archived: !!mod.archivedAt,
              priceFieldId: mod.priceFieldId,
              imageFieldId: mod.imageFieldId,
              codeFieldId: mod.codeFieldId,
            }}
            fields={fieldRows.map((f) => ({ id: f.id, label: f.label, type: f.type }))}
          />
        </div>
      </div>
    </div>
  );
}
