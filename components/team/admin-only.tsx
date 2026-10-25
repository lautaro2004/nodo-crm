import { EmptyState } from "@/components/ui/primitives";

// Pantalla de configuración abierta por alguien sin permiso (ej. un
// miembro que entra por URL directa). Las APIs ya lo bloquean igual.
export function AdminOnly() {
  return (
    <EmptyState
      title="Solo para administradores"
      description="Esta sección la configuran el dueño o los administradores del negocio. Si necesitás un cambio, pedíselo a ellos."
    />
  );
}

// Módulo que la persona no tiene permiso para ver (lib/access.ts).
export function NoAccess({ what = "este módulo" }: { what?: string }) {
  return (
    <EmptyState
      title="No tenés acceso"
      description={`Tu rol no incluye ver ${what}. Si lo necesitás, pedíselo al dueño o a un administrador del negocio.`}
    />
  );
}
