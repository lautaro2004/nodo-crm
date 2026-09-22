import Link from "next/link";

import { SearchIcon } from "@/components/ui/icons";
import { UserMenu } from "@/components/dashboard/user-menu";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import type { ModuleLabel } from "@/modules/workspace/module-config-shared";

export function Topbar({
  businessName,
  activeModules,
  opportunityLabel,
}: {
  businessName: string;
  activeModules: string[];
  opportunityLabel: ModuleLabel;
}) {
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <MobileNav businessName={businessName} activeModules={activeModules} opportunityLabel={opportunityLabel} />
        <Link
          href="/dashboard/buscar"
          className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
        >
          <SearchIcon className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Buscar…</span>
        </Link>
      </div>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
