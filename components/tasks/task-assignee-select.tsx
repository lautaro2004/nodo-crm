"use client";

import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/primitives";

interface Member {
  userId: string;
  name: string;
  email: string;
}

// Reasignación real entre miembros del MISMO Business — el servidor
// (modules/tasks/service.ts, assertRelationsBelongToBusiness) es quien
// impone el límite vía Membership; acá solo se ofrecen las opciones ya
// filtradas por listWorkspaceMembers.
export function TaskAssigneeSelect({ taskId, ownerId, members }: { taskId: string; ownerId: string | null; members: Member[] }) {
  const router = useRouter();

  async function handleChange(next: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: next || null }),
    });
    router.refresh();
  }

  return (
    <Select value={ownerId ?? ""} onChange={(e) => handleChange(e.target.value)} className="w-auto">
      <option value="">Sin asignar</option>
      {members.map((m) => (
        <option key={m.userId} value={m.userId}>
          {m.name || m.email}
        </option>
      ))}
    </Select>
  );
}
