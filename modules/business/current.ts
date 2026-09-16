import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

// Mismo patrón exacto que nexo/modules/business/current.ts — misma
// limitación conocida (findFirst sin orderBy, ver
// docs/architecture/crm-fase2-bootstrap.md). No se puede "importar" esta
// función desde Nexo (son dos repos/proyectos Next.js separados) — se
// reimplementa a propósito, igual que Better Auth mismo.
export async function getCurrentBusinessId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
  });

  return membership?.businessId ?? null;
}
