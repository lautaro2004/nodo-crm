import Link from "next/link";

import { Card } from "@/components/ui/primitives";

// "Relacionado con este registro": registros de módulos personalizados que
// apuntan a éste mediante un campo relación (vista inversa de RecordLink).
export function RelatedGroups({
  groups,
  emptyText,
}: {
  groups: { title: string; items: { id: string; label: string; href: string }[] }[];
  emptyText: string | null;
}) {
  if (groups.length === 0) {
    return emptyText ? (
      <Card className="p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Relacionados</h2>
        <p className="text-sm text-slate-400">{emptyText}</p>
      </Card>
    ) : null;
  }
  return (
    <>
      {groups.map((g) => (
        <Card key={g.title} className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">{g.title}</h2>
          <ul className="space-y-1.5 text-sm">
            {g.items.map((i) => (
              <li key={i.id}>
                <Link href={i.href} className="text-slate-700 hover:text-brand-700">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </>
  );
}
