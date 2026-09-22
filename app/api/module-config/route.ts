import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { moduleConfigUpdateSchema } from "@/lib/schemas";
import { listModuleLabels, updateModuleLabel } from "@/modules/workspace/module-config";

export async function GET() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  return NextResponse.json(await listModuleLabels(ctx.businessId));
}

export async function PUT(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, moduleConfigUpdateSchema);
  if (!data) return badRequest;

  const label = await updateModuleLabel(ctx.businessId, data.internalModule, {
    labelSingular: data.labelSingular,
    labelPlural: data.labelPlural,
    icon: data.icon,
  });
  return NextResponse.json(label);
}
