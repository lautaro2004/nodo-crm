import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound, domainErrorResponse, requireRecordAccess } from "@/lib/api-guard";
import { contactUpdateSchema } from "@/lib/schemas";
import { getContact, updateContact, deleteContact } from "@/modules/contacts/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "contact", id, "view");
  if (denied) return denied;
  const record = await getContact(ctx.businessId, id);
  if (!record) return notFound();
  return NextResponse.json(record);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "contact", id, "edit");
  if (denied) return denied;
  const { data, response: badRequest } = await parseBody(request, contactUpdateSchema);
  if (!data) return badRequest;

  try {
    const record = await updateContact(ctx.businessId, id, data, ctx.userId);
    if (!record) return notFound();
    return NextResponse.json(record);
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "contact", id, "delete");
  if (denied) return denied;
  const ok = await deleteContact(ctx.businessId, id, ctx.userId);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
