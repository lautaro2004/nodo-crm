import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { contactUpdateSchema } from "@/lib/schemas";
import { getContact, updateContact, deleteContact } from "@/modules/contacts/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const contact = await getContact(ctx.businessId, id);
  if (!contact) return notFound();
  return NextResponse.json(contact);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, contactUpdateSchema);
  if (!data) return badRequest;

  try {
    const contact = await updateContact(ctx.businessId, id, data);
    if (!contact) return notFound();
    return NextResponse.json(contact);
  } catch {
    return NextResponse.json({ error: "company_not_found" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const ok = await deleteContact(ctx.businessId, id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
