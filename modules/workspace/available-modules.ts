// Única fuente de verdad de "qué módulos existen y se pueden prender/
// apagar" — Workspace.activeModules es un string[] libre, pero sólo estas
// keys tienen efecto real en la app (gating en components/dashboard/
// sidebar.tsx). Compartido entre el onboarding (paso "¿Qué querés
// gestionar?") y Configuración → Módulos activos: antes cada uno tenía su
// propia lista hardcodeada, ahora es una sola (evita que se desincronicen
// entre sí, mismo criterio que ya se aplicó con ModuleConfig).
export const AVAILABLE_MODULES = ["companies", "contacts", "leads", "opportunities", "tasks"] as const;
export type AvailableModule = (typeof AVAILABLE_MODULES)[number];

// Label fijo para los módulos que NO son configurables por nombre.
// "opportunities" es la excepción — su nombre visible sale de
// ModuleLabel/IndustryTemplate.moduleLabel, nunca de acá.
export const STATIC_MODULE_LABELS: Record<Exclude<AvailableModule, "opportunities">, string> = {
  companies: "Empresas / Clientes",
  contacts: "Contactos",
  leads: "Leads",
  tasks: "Tareas",
};

export function isAvailableModule(v: string): v is AvailableModule {
  return (AVAILABLE_MODULES as readonly string[]).includes(v);
}
