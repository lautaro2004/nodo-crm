import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { contactCreateSchema } from "@/lib/schemas";
import { createContact, listContacts } from "@/modules/contacts/service";
import { defaultOwnerFor, scopeWhere } from "@/modules/access/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace({ permission: { entity: "contact", action: "view" } });
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  const contacts = await listContacts(ctx.businessId, {
    search: searchParams.get("q") ?? undefined,
    companyId: searchParams.get("companyId") ?? undefined,
    scope: scopeWhere(ctx.access, "contact"),
  });
  return NextResponse.json(contacts);
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace({ permission: { entity: "contact", action: "create" } });
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, contactCreateSchema);
  if (!data) return badRequest;

  try {
    const contact = await createContact(
      ctx.businessId,
      { ...data, ownerId: defaultOwnerFor(ctx.access, "contact", data.ownerId) },
      { enforceRequired: data.customValues !== undefined, actorUserId: ctx.userId }
    );
    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
