import { resolveWorkspaceContext } from "@/lib/workspace";
import { listRecentActivities } from "@/modules/activities/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { PageHeader } from "@/components/ui/primitives";
import { ActivityFeed } from "@/components/activities/activity-feed";

export default async function ActivitiesPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const [activities, members] = await Promise.all([
    listRecentActivities(ctx.businessId, 100),
    listWorkspaceMembers(ctx.businessId),
  ]);
  const memberNameById = new Map(members.map((m) => [m.userId, m.name || m.email]));

  return (
    <div>
      <PageHeader title="Actividad" description="Historial de interacción de todo el Workspace." />
      <ActivityFeed activities={activities} memberNameById={memberNameById} showRelatedLink />
    </div>
  );
}
