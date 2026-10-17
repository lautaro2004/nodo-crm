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
