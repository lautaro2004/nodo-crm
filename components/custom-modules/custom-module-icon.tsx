import type { SVGProps } from "react";

import { BoxIcon, BriefcaseIcon, CalendarIcon, FileIcon, HomeIcon, StarIcon, TagIcon, WrenchIcon } from "@/components/ui/icons";

const ICONS: Record<string, (p: SVGProps<SVGSVGElement>) => React.ReactElement> = {
  box: BoxIcon,
  tag: TagIcon,
  calendar: CalendarIcon,
  home: HomeIcon,
  file: FileIcon,
  wrench: WrenchIcon,
  briefcase: BriefcaseIcon,
  star: StarIcon,
};

export function CustomModuleIcon({ iconName, ...props }: { iconName: string | null | undefined } & SVGProps<SVGSVGElement>) {
  const Cmp = ICONS[iconName ?? ""] ?? BoxIcon;
  return <Cmp {...props} />;
}
