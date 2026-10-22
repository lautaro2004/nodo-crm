"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { SelectMenu } from "@/components/ui/select-menu";
import { Spinner } from "@/components/ui/primitives";
import { useSession } from "@/lib/auth/auth-client";
import { readApiError } from "@/lib/error-messages";

// Selector de responsable entre los miembros del Workspace (los recibe del
// servidor vía listWorkspaceMembers — nunca se escribe un userId libre).
// El backend vuelve a validar la membresía (assertOptionalOwner), así que
// un id manipulado se rechaza igual. Optimista con reversión y mensaje.
export function OwnerAssign({
  apiPath,
  ownerId,
  members,
}: {
  apiPath: string;
  ownerId: string | null;
  members: { userId: string; name: string; email: string }[];
}) {
  const router = useRouter();
  const { data } = useSession();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(ownerId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setValue(ownerId ?? ""), [ownerId]);

  async function save(next: string) {
    const previous = value;
    setValue(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: next || null }),
      });
      if (!res.ok) {
        setValue(previous);
        setError(await readApiError(res));
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setValue(previous);
      setError("Sin conexión. El cambio no se guardó.");
    } finally {
      setSaving(false);
    }
  }

  const me = data?.user.id;
  return (
    <div>
      <div className="flex items-center gap-2">
        <SelectMenu
          ariaLabel="Responsable"
          value={value}
          loading={saving}
          onChange={save}
          className="w-auto min-w-48"
          options={[
            { value: "", label: "Sin asignar" },
            ...members.map((m) => ({
              value: m.userId,
              label: `${m.name || m.email}${m.userId === me ? " (vos)" : ""}`,
              hint: m.name ? m.email : undefined,
            })),
          ]}
        />
        {me && value !== me && members.some((m) => m.userId === me) && (
          <button type="button" disabled={saving} onClick={() => save(me)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline disabled:opacity-50">
            {saving && <Spinner className="h-3 w-3" />}
            Asignarme
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
