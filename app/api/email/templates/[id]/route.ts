import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { emailTemplateUpdateSchema } from "@/lib/schemas";
import { emailErrorResponse } from "@/modules/email/errors";
import { deleteTemplate, getTemplate, updateTemplate } from "@/modules/email/templates";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  const template = await getTemplate(ctx.businessId, id);
  return template ? NextResponse.json(template) : notFound();
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;

  const { data, response: badRequest } = await parseBody(request, emailTemplateUpdateSchema);
  if (!data) return badRequest;
  try {
    const template = await updateTemplate(ctx.businessId, id, data);
    return template ? NextResponse.json(template) : notFound();
  } catch (err) {
    return emailErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  return (await deleteTemplate(ctx.businessId, id)) ? NextResponse.json({ ok: true }) : notFound();
}
