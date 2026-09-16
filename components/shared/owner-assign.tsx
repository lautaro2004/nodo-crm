"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/primitives";
import { useSession } from "@/lib/auth/auth-client";

// "Asignar usuario" mínimo para esta fase: sin invitar miembros ni un
// roster de usuarios todavía (no existe esa funcionalidad — ver Fase 3Q,
// "no construir permisos granulares completos"), la única acción posible
// hoy es asignarse/desasignarse a uno mismo. Cuando exista invitación de
// equipo, este componente se reemplaza por un selector real de usuarios
// del Workspace — el campo ownerId ya está listo para eso desde ahora.
export function OwnerAssign({ apiPath, ownerId }: { apiPath: string; ownerId: string | null }) {
  const router = useRouter();
  const { data } = useSession();
  const isMine = ownerId === data?.user.id;

  async function toggle() {
    await fetch(apiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: isMine ? null : data?.user.id }),
    });
    router.refresh();
  }

  return (
    <Button type="button" variant="secondary" onClick={toggle}>
      {isMine ? "Quitarme como responsable" : ownerId ? "Reasignarme" : "Asignarme"}
    </Button>
  );
}
