import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import type { FieldValidation } from "@/lib/custom-fields";
import { STANDARD_MODULES } from "@/lib/entities";
import { STANDARD_RELATION_TARGETS, moduleEntityType } from "@/lib/custom-modules";
import { AdminOnly } from "@/components/team/admin-only";
import { listCustomFieldDefinitions } from "@/modules/custom-fields/service";
import { listModules } from "@/modules/custom-modules/service";
import { canAdminister, resolveAccess } from "@/modules/access/service";
import { getModuleLabel } from "@/modules/workspace/module-config";
import { PageHeader } from "@/components/ui/primitives";
import { ModuleFieldsEditor } from "@/components/custom-modules/module-fields-editor";

type SP = Record<string, string | string[] | undefined>;

// Campos personalizados de los módulos estándar (Leads, Contactos,
// Empresas, Oportunidades, Tareas). Usa el MISMO editor que los módulos
// personalizados: nombre, descripción, opciones editables, predeterminado,
// obligatorio, validaciones y relaciones con cardinalidad.
export default async function CustomFieldsSettingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!canAdminister(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), "fields")) return <AdminOnly />;

  const sp = await searchParams;
  const active = STANDARD_MODULES.find((m) => m.entityType === sp.modulo) ?? STANDARD_MODULES[0];
  const [definitions, modules, opportunityLabel] = await Promise.all([
    listCustomFieldDefinitions(ctx.businessId, active.entityType),
    listModules(ctx.businessId),
    getModuleLabel(ctx.businessId, "opportunity"),
  ]);
  const plural = (m: (typeof STANDARD_MODULES)[number]) => (m.entityType === "opportunity" ? opportunityLabel.labelPlural : m.plural);

  const targets = [
    ...STANDARD_RELATION_TARGETS,
    { value: "task", label: "Tareas" },
    ...modules.map((m) => ({ value: moduleEntityType(m.id), label: m.labelPlural })),
  ];
  const targetLabel = new Map(targets.map((t) => [t.value, t.label]));
  const fields = definitions.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    options: f.options,
    required: f.required,
    targetEntity: f.targetEntity,
    targetLabel: f.targetEntity ? (targetLabel.get(f.targetEntity) ?? "Módulo archivado") : null,
    multiple: f.multiple,
    exclusive: f.exclusive,
    inverseLabel: f.inverseLabel,
    description: f.description,
    defaultValue: f.defaultValue,
    validation: (f.validation as FieldValidation | null) ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Campos personalizados"
        description="Campos propios de cada módulo estándar. Los módulos que creaste se configuran desde Configuración → Módulos."
        backHref="/dashboard/configuracion"
        backLabel="Configuración"
      />
      <nav aria-label="Módulos" className="mb-4 flex flex-wrap gap-1.5">
        {STANDARD_MODULES.map((m) => {
          const on = m.entityType === active.entityType;
          return (
            <Link
              key={m.entityType}
              href={`/dashboard/configuracion/campos-personalizados?modulo=${m.entityType}`}
              aria-current={on ? "page" : undefined}
              className={`inline-flex h-8 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${
                on ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {plural(m)}
            </Link>
          );
        })}
        {modules.length > 0 && (
          <Link href="/dashboard/modulos" className="inline-flex h-8 items-center px-2 text-sm text-slate-500 hover:text-brand-700">
            Módulos personalizados →
          </Link>
        )}
      </nav>
      <div className="max-w-4xl">
        <ModuleFieldsEditor
          key={active.entityType}
          entityType={active.entityType}
          fields={fields}
          targets={targets}
          title={`Campos de ${plural(active)}`}
          intro="Los campos estándar (nombre, email, estado…) siempre están. Sumá los tuyos; el orden es el de la ficha."
          allowImage={false}
        />
      </div>
    </div>
  );
}
