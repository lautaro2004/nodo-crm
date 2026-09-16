import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { updateWorkspaceModules } from "@/modules/workspace/service";

const bodySchema = z.object({ activeModules: z.array(z.string()) });

export async function PATCH(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, bodySchema);
  if (!data) return badRequest;

  const workspace = await updateWorkspaceModules(ctx.businessId, data.activeModules);
  return NextResponse.json(workspace);
}
