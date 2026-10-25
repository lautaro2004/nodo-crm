import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getModuleByKey } from "@/modules/custom-modules/service";
import { loadRecordFormData } from "@/modules/custom-modules/view";
import { RecordForm } from "@/components/custom-modules/record-form";
import { can, resolveAccess } from "@/modules/access/service";
import { NoAccess } from "@/components/team/admin-only";

export default async function NewRecordPage({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  const { key } = await params;
  const mod = await getModuleByKey(ctx.businessId, key);
  if (!mod || mod.archivedAt) notFound();
  if (!can(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), `cm:${mod.id}`, "create")) return <NoAccess what="crear registros acá" />;
  const data = await loadRecordFormData(ctx.businessId, mod.id);
  const basePath = `/dashboard/m/${mod.key}`;

  return (
    <div>
      <PageHeader title={`Nuevo ${mod.labelSingular.toLowerCase()}`} backHref={basePath} backLabel={mod.labelPlural} />
      <Card className="max-w-3xl p-4 sm:p-6">
        <RecordForm moduleId={mod.id} basePath={basePath} singular={mod.labelSingular.toLowerCase()} fields={data.fields} members={data.members} />
      </Card>
    </div>
  );
}
