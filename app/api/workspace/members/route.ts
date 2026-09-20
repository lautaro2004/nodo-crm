import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { listWorkspaceMembers } from "@/modules/business/members";

export async function GET() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const members = await listWorkspaceMembers(ctx.businessId);
  return NextResponse.json(members);
}
