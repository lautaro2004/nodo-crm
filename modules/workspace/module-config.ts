import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MODULE_LABELS,
  INTERNAL_MODULES,
  INTERNAL_MODULE_ACTIVE_KEY,
  MODULE_ICONS,
  type InternalModule,
  type ModuleIconKey,
  type ModuleLabel,
} from "@/modules/workspace/module-config-shared";

export { INTERNAL_MODULES, INTERNAL_MODULE_ACTIVE_KEY, MODULE_ICONS, DEFAULT_MODULE_LABELS };
export type { InternalModule, ModuleIconKey, ModuleLabel };

function isModuleIcon(v: string | null): v is ModuleIconKey {
  return !!v && (MODULE_ICONS as readonly string[]).includes(v);
}

// Combina el default con lo que el Workspace haya guardado (si guardó
// algo) — así una fila ausente en ModuleConfig sigue devolviendo un label
// válido en vez de null/undefined en toda la UI.
export async function getModuleLabel(businessId: string, internalModule: InternalModule): Promise<ModuleLabel> {
  const [row, workspace] = await Promise.all([
    prisma.moduleConfig.findUnique({ where: { businessId_internalModule: { businessId, internalModule } } }),
    prisma.workspace.findUnique({ where: { businessId }, select: { activeModules: true } }),
  ]);
  const fallback = DEFAULT_MODULE_LABELS[internalModule];
  const activeKey = INTERNAL_MODULE_ACTIVE_KEY[internalModule];

  return {
    internalModule,
    labelSingular: row?.labelSingular || fallback.labelSingular,
    labelPlural: row?.labelPlural || fallback.labelPlural,
    icon: isModuleIcon(row?.icon ?? null) ? (row!.icon as ModuleIconKey) : fallback.icon,
    enabled: workspace?.activeModules.includes(activeKey) ?? false,
  };
}

export async function listModuleLabels(businessId: string): Promise<ModuleLabel[]> {
  return Promise.all(INTERNAL_MODULES.map((m) => getModuleLabel(businessId, m)));
}

export interface UpdateModuleLabelInput {
  labelSingular: string;
  labelPlural: string;
  icon?: ModuleIconKey | null;
}

// Scopeado a businessId por el propio `where` del upsert (Fase 7 —
// aislamiento) — nunca toca la fila de otro Workspace.
export async function updateModuleLabel(businessId: string, internalModule: InternalModule, input: UpdateModuleLabelInput) {
  const data = { labelSingular: input.labelSingular, labelPlural: input.labelPlural, icon: input.icon ?? null };
  await prisma.moduleConfig.upsert({
    where: { businessId_internalModule: { businessId, internalModule } },
    create: { businessId, internalModule, ...data },
    update: data,
  });
  return getModuleLabel(businessId, internalModule);
}

// Siembra el label del template de industria — SOLO si el Workspace
// todavía no personalizó nada (mismo criterio que
// applyIndustryTemplate ya usa para Pipeline/StatusDefinition: nunca pisa
// lo que el dueño ya haya tocado a mano).
export async function seedModuleLabelIfEmpty(
  businessId: string,
  internalModule: InternalModule,
  label: { labelSingular: string; labelPlural: string; icon: ModuleIconKey }
) {
  const existing = await prisma.moduleConfig.findUnique({ where: { businessId_internalModule: { businessId, internalModule } } });
  if (existing) return;
  await prisma.moduleConfig.create({ data: { businessId, internalModule, ...label } });
}
