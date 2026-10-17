import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { availableProducts, listTeam } from "@/modules/team/service";

export async function GET() {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const [team, products] = await Promise.all([listTeam(ctx.businessId), availableProducts(ctx.businessId)]);
  return NextResponse.json({
    products,
    members: team.members.map((m) => ({ id: m.id, userId: m.userId, name: m.user.name, email: m.user.email, role: m.role, products: m.products, createdAt: m.createdAt })),
    // Nunca se expone tokenHash.
    invitations: team.invitations.map((inv) => ({ id: inv.id, email: inv.email, role: inv.role, products: inv.products, expiresAt: inv.expiresAt, createdAt: inv.createdAt })),
  });
}
