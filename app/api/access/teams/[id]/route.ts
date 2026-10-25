import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspace, parseBody, domainErrorResponse, notFound } from "@/lib/api-guard";
import { deleteTeam, updateTeam } from "@/modules/access/service";

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(300).optional().nullable(),
  parentId: z.string().trim().min(1).max(60).nullable().optional(),
  leadUserId: z.string().trim().min(1).max(60).nullable().optional(),
  memberIds: z.array(z.string().trim().min(1).max(60)).max(200).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, schema);
  if (!data) return badRequest;
  try {
    const team = await updateTeam(ctx.businessId, ctx, id, data);
    return team ? NextResponse.json(team) : notFound();
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { id } = await params;
  try {
    return (await deleteTeam(ctx.businessId, ctx, id)) ? NextResponse.json({ ok: true }) : notFound();
  } catch (err) {
    return domainErrorResponse(err);
  }
}
