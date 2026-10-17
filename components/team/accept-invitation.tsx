"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Spinner } from "@/components/ui/primitives";
import { signOut } from "@/lib/auth/auth-client";
import { readApiError } from "@/lib/error-messages";

export function AcceptInvitation({ token, mode, email, nodoAccess = true }: { token: string; mode: "accept" | "switch"; email: string; nodoAccess?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function accept() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      setLoading(false);
      setError(await readApiError(res));
      return;
    }
    if (!nodoAccess) {
      // Solo se le dio acceso a Nexo: no tiene nada que hacer en Nodo.
      setLoading(false);
      setDone(true);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function switchAccount() {
    setLoading(true);
    await signOut();
    router.push(`/login?${new URLSearchParams({ next: `/invitacion/${token}`, email })}`);
    router.refresh();
  }

  if (done) {
    return (
      <p className="mt-5 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200" role="status">
        ¡Listo! Ya sos parte del equipo. Entrá a Nexo con este mismo email y contraseña.
      </p>
    );
  }

  return (
    <div className="mt-5">
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="button" className="w-full" disabled={loading} onClick={mode === "accept" ? accept : switchAccount}>
        {loading && <Spinner />}
        {mode === "accept" ? "Aceptar invitación" : "Cerrar sesión y entrar con el email invitado"}
      </Button>
    </div>
  );
}
