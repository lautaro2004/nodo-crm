import type { SVGProps } from "react";

import { TrendingUpIcon, TargetIcon, CalendarIcon, CheckSquareIcon, BuildingIcon } from "@/components/ui/icons";
import type { ModuleIconKey } from "@/modules/workspace/module-config-shared";

const ICONS: Record<ModuleIconKey, (props: SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  "trending-up": TrendingUpIcon,
  target: TargetIcon,
  calendar: CalendarIcon,
  "check-square": CheckSquareIcon,
  building: BuildingIcon,
};

export function ModuleIcon({ icon, ...props }: { icon: string } & SVGProps<SVGSVGElement>) {
  const Cmp = ICONS[icon as ModuleIconKey] ?? TrendingUpIcon;
  return <Cmp {...props} />;
}
