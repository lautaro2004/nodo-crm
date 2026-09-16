import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { contactCreateSchema } from "@/lib/schemas";
import { createContact, listContacts } from "@/modules/contacts/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  const contacts = await listContacts(ctx.businessId, {
    search: searchParams.get("q") ?? undefined,
    companyId: searchParams.get("companyId") ?? undefined,
  });
  return NextResponse.json(contacts);
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, contactCreateSchema);
  if (!data) return badRequest;

  try {
    const contact = await createContact(ctx.businessId, data);
    return NextResponse.json(contact, { status: 201 });
  } catch {
    return NextResponse.json({ error: "company_not_found" }, { status: 400 });
  }
}
