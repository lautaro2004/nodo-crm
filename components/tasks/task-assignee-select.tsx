"use client";

import { OwnerAssign } from "@/components/shared/owner-assign";

interface Member {
  userId: string;
  name: string;
  email: string;
}

// Reasignación real entre miembros del MISMO Business — el servidor
// (modules/tasks/service.ts, assertRelationsBelongToBusiness) es quien
// impone el límite vía Membership; acá solo se ofrecen las opciones ya
// filtradas por listWorkspaceMembers.
//
// Reutiliza OwnerAssign (optimista con reversión, error visible, estado de
// guardado). Antes el select quedaba "pegado" en el valor anterior hasta
// que terminaba el refresh y los errores se ignoraban.
export function TaskAssigneeSelect({ taskId, ownerId, members }: { taskId: string; ownerId: string | null; members: Member[] }) {
  return <OwnerAssign apiPath={`/api/tasks/${taskId}`} ownerId={ownerId} members={members} />;
}
