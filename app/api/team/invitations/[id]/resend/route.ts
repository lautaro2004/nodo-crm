import { NextResponse } from "next/server";

import { requireWorkspace, notFound, domainErrorResponse } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createInvitation } from "@/modules/team/service";
import { appBaseUrl, sendInvitationEmail } from "@/modules/team/invite-email";
import type { Product, Role } from "@/lib/permissions";

// Reenviar = nueva invitación con los mismos datos (link nuevo, vencimiento
// renovado); la anterior se revoca dentro de createInvitation.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { id } = await params;
  const prev = await prisma.invitation.findFirst({ where: { id, businessId: ctx.businessId, acceptedAt: null, revokedAt: null } });
  if (!prev) return notFound();
  try {
    const { invitation, token } = await createInvitation(ctx.businessId, ctx, { email: prev.email, role: prev.role, products: prev.products });
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
      role: invitation.role as Role,
      products: invitation.products as Product[],
    });
    return NextResponse.json({ id: invitation.id, email: invitation.email, link, emailSent: email.sent }, { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
