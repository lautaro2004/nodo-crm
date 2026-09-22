import { NextResponse } from "next/server";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { parseBody } from "@/lib/api-guard";
import { onboardingSchema } from "@/lib/schemas";
import { ensureBusinessMembership } from "@/modules/business/membership";
import { ensureWorkspace, applyIndustryTemplate } from "@/modules/workspace/service";

// Ruta delgada: resuelve sesión, delega en los módulos. No confía en
// ningún businessId enviado por el cliente — el único dato que acepta del
// body es businessName (para crear uno nuevo), industry y, opcionalmente,
// activeModules (paso 2 del onboarding: la selección editable de módulos
// sugeridos — ver componentes/onboarding/onboarding-form.tsx).
export async function POST(request: Request) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data, response } = await parseBody(request, onboardingSchema);
  if (!data) return response;

  const businessId =
    ctx.status === "no_business" ? await ensureBusinessMembership(ctx.userId, data.businessName || "Mi negocio") : ctx.businessId;

  await ensureWorkspace(businessId);

  if (data.industry) {
    await applyIndustryTemplate(businessId, data.industry, data.activeModules);
  }

  return NextResponse.json({ ok: true, businessId });
}
