import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { invitationCreateSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { createInvitation } from "@/modules/team/service";
import { appBaseUrl, sendInvitationEmail } from "@/modules/team/invite-email";
import type { Product } from "@/lib/permissions";

// Invitar: crea la invitación, intenta mandar el email y SIEMPRE devuelve el
// link (el dueño puede copiarlo y mandarlo por WhatsApp). El link solo vive
// en esta respuesta y en el email: en la base queda el hash.
export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { data, response: badRequest } = await parseBody(request, invitationCreateSchema);
  if (!data) return badRequest;

  try {
    const { invitation, token } = await createInvitation(ctx.businessId, ctx, data);
    const link = `${appBaseUrl(request)}/invitacion/${token}`;
    const [business, inviter] = await Promise.all([
      prisma.business.findUnique({ where: { id: ctx.businessId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
    ]);
    const email = await sendInvitationEmail({
      to: invitation.email,
      link,
      businessName: business?.name ?? "tu negocio",
      inviterName: inviter?.name ?? null,
      role: data.role,
      products: invitation.products as Product[],
    });
    return NextResponse.json({ id: invitation.id, email: invitation.email, link, emailSent: email.sent }, { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
