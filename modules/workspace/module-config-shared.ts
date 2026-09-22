// Único módulo configurable hoy: Opportunity — es el único que ya es un
// "proceso con etapas" genérico (Pipeline/PipelineStage). Leads/Contacts/
// Companies/Tasks tienen semántica fija y no forman parte de esta fase
// (ver "constructor visual de módulos" en el alcance futuro). Agregar un
// segundo módulo configurable más adelante es: sumar su key acá + su
// entrada en DEFAULT_MODULE_LABELS/INTERNAL_MODULE_ACTIVE_KEY — no hace
// falta tocar el modelo de datos.
export const INTERNAL_MODULES = ["opportunity"] as const;
export type InternalModule = (typeof INTERNAL_MODULES)[number];

// "Habilitado" NO se guarda en ModuleConfig — se deriva de
// Workspace.activeModules (única fuente de verdad ya existente, ver
// comentario del modelo en prisma/schema.prisma) para no duplicar ese
// estado en dos lugares que podrían desincronizarse.
export const INTERNAL_MODULE_ACTIVE_KEY: Record<InternalModule, string> = {
  opportunity: "opportunities",
};

// Íconos reutilizados tal cual de components/ui/icons.tsx — ver
// components/ui/module-icon.tsx. No se agrega ningún ícono nuevo.
export const MODULE_ICONS = ["trending-up", "target", "calendar", "check-square", "building"] as const;
export type ModuleIconKey = (typeof MODULE_ICONS)[number];

export interface ModuleLabel {
  internalModule: InternalModule;
  labelSingular: string;
  labelPlural: string;
  icon: ModuleIconKey;
  enabled: boolean;
}

export const DEFAULT_MODULE_LABELS: Record<InternalModule, Omit<ModuleLabel, "enabled">> = {
  opportunity: { internalModule: "opportunity", labelSingular: "Oportunidad", labelPlural: "Oportunidades", icon: "trending-up" },
};

