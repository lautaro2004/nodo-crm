import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { listTemplates } from "@/modules/email/templates";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui/primitives";

export default async function TemplatesPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const templates = await listTemplates(ctx.businessId);

  return (
    <div>
      <PageHeader
        title="Plantillas de email"
        description="Usá variables como {{contact.name}} para personalizar cada envío."
        backHref="/dashboard/configuracion"
        actions={
          <Link href="/dashboard/configuracion/plantillas/nueva">
            <Button>Nueva plantilla</Button>
          </Link>
        }
      />
      {templates.length === 0 ? (
        <EmptyState title="Todavía no hay plantillas" description="Creá la primera para poder enviar correos desde contactos, leads y oportunidades." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {templates.map((t) => (
            <Link key={t.id} href={`/dashboard/configuracion/plantillas/${t.id}`} className="block px-4 py-3 hover:bg-slate-50">
              <p className="text-sm font-medium text-slate-900">{t.name}</p>
              <p className="truncate text-xs text-slate-500">{t.subject}</p>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
