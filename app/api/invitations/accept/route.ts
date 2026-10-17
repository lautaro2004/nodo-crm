import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { parseBody, domainErrorResponse } from "@/lib/api-guard";
import { invitationAcceptSchema } from "@/lib/schemas";
import { acceptInvitation } from "@/modules/team/service";

// Aceptar una invitación: requiere sesión (el email de la sesión tiene que
// ser el invitado), NO requiere Workspace — es justamente el paso que crea
// la membresía.
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { data, response } = await parseBody(request, invitationAcceptSchema);
  if (!data) return response;
  try {
    await acceptInvitation(data.token, { id: session.user.id, email: session.user.email });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
