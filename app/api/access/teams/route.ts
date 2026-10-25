import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { createTeam } from "@/modules/access/service";

const teamSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre").max(80),
  description: z.string().trim().max(300).optional().nullable(),
  parentId: z.string().trim().min(1).max(60).nullable().optional(),
  leadUserId: z.string().trim().min(1).max(60).nullable().optional(),
  memberIds: z.array(z.string().trim().min(1).max(60)).max(200).optional(),
});

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { data, response: badRequest } = await parseBody(request, teamSchema);
  if (!data) return badRequest;
  try {
    return NextResponse.json(await createTeam(ctx.businessId, ctx, data), { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
