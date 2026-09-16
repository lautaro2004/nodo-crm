import Link from "next/link";

import { SearchIcon } from "@/components/ui/icons";
import { UserMenu } from "@/components/dashboard/user-menu";

export function Topbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur-sm">
      <Link
        href="/dashboard/buscar"
        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
      >
        <SearchIcon className="h-4 w-4" />
        Buscar…
      </Link>
      <UserMenu />
    </header>
  );
}
