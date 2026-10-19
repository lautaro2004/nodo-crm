"use client";

import { useState } from "react";

import { signOut, useSession } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/primitives";
import { LogOutIcon } from "@/components/ui/icons";

export function UserMenu() {
  const { data } = useSession();
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const initial = data?.user.email?.[0]?.toUpperCase() ?? "?";

  async function handleSignOut() {
    if (leaving) return;
    setLeaving(true);
    setFailed(false);
    try {
      const res = await signOut();
      if (res?.error) throw new Error(res.error.message);
      // Navegación completa: descarta todo el estado en memoria de la sesión.
      window.location.assign("/login");
    } catch {
      setLeaving(false);
      setFailed(true);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {data?.user.email && (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white ring-2 ring-white">
            {initial}
          </span>
          <span className="hidden max-w-48 truncate text-sm text-slate-500 md:inline">{data.user.email}</span>
        </div>
      )}
      {failed && (
        <span role="alert" className="text-xs text-red-600">
          No se pudo cerrar la sesión
        </span>
      )}
      <Button variant="ghost" size="sm" onClick={handleSignOut} loading={leaving}>
        {!leaving && <LogOutIcon className="h-4 w-4" />}
        <span className="hidden sm:inline">{leaving ? "Cerrando…" : "Cerrar sesión"}</span>
      </Button>
    </div>
  );
}
