import Link from "next/link";
import type { ReactNode } from "react";

import { Card, Table, Th, Td } from "@/components/ui/primitives";
import { CustomCell } from "@/components/custom-fields/custom-cell";
import { RECORD_COLUMNS } from "@/lib/views/columns";
import type { CustomCells } from "@/modules/custom-fields/columns";

interface RecordRow {
  id: string;
  title: string;
  ownerId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const day = (d: Date) => d.toLocaleDateString("es-AR");

export function RecordTable({
  basePath,
  records,
  columns,
  custom,
  ownerName,
  thumbs,
}: {
  basePath: string;
  records: RecordRow[];
  columns: string[];
  custom: CustomCells;
  ownerName: (id: string) => string | undefined;
  /** recordId → URL firmada de la miniatura (si el módulo tiene imagen). */
  thumbs?: Map<string, string>;
}) {
  const cell: Record<string, (r: RecordRow) => ReactNode> = {
    title: (r) => (
      <Link href={`${basePath}/${r.id}`} className="flex items-center gap-2.5 font-medium text-slate-900 hover:text-brand-700">
        {thumbs && (
          <span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200">
            {thumbs.get(r.id) && (
              // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage, no optimizable por next/image
              <img src={thumbs.get(r.id)} alt="" className="h-full w-full object-cover" loading="lazy" />
            )}
          </span>
        )}
        <span className="truncate">{r.title}</span>
      </Link>
    ),
    owner: (r) => (r.ownerId ? <span className="text-slate-700">{ownerName(r.ownerId) ?? "—"}</span> : <span className="text-slate-400">Sin asignar</span>),
    created: (r) => <span className="whitespace-nowrap text-slate-500">{day(r.createdAt)}</span>,
    updated: (r) => <span className="whitespace-nowrap text-slate-500">{day(r.updatedAt)}</span>,
  };
  const label = (key: string) => RECORD_COLUMNS.find((c) => c.key === key)?.label ?? custom.columns.get(key)?.label ?? key;
  const numeric = (key: string) => ["number", "currency"].includes(custom.columns.get(key)?.type ?? "");

  return (
    <Card className="overflow-hidden">
      <Table>
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((c) => (
              <Th key={c} className={numeric(c) ? "text-right" : undefined}>
                {label(c)}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80">
              {columns.map((c) => (
                <Td key={c}>{cell[c] ? cell[c](r) : <CustomCell custom={custom} columnKey={c} entityId={r.id} />}</Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
