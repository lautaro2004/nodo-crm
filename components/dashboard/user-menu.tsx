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
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white ring-2 ring-white">
            {initial}
          </span>
          <span className="hidden max-w-48 truncate text-sm text-slate-500 md:inline">{data.user.email}</span>
        </div>
      )}
      <Button variant="ghost" size="sm" onClick={handleSignOut}>
        <LogOutIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Cerrar sesión</span>
      </Button>
    </div>
  );
}
