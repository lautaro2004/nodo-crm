"use client";

import { useRouter } from "next/navigation";

import { signOut, useSession } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/primitives";
import { LogOutIcon } from "@/components/ui/icons";

export function UserMenu() {
  const router = useRouter();
  const { data } = useSession();
  const initial = data?.user.email?.[0]?.toUpperCase() ?? "?";

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {data?.user.email && (
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            {initial}
          </span>
          <span className="hidden text-sm text-slate-500 sm:inline">{data.user.email}</span>
        </div>
      )}
      <Button variant="ghost" size="sm" onClick={handleSignOut}>
        <LogOutIcon className="h-4 w-4" />
        Cerrar sesión
      </Button>
    </div>
  );
}
