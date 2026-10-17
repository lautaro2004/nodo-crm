import Link from "next/link";
import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { getInvitationByToken } from "@/modules/team/service";
import { PRODUCT_LABELS, ROLE_HINTS, ROLE_LABELS } from "@/lib/permissions";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/primitives";
import { AcceptInvitation } from "@/components/team/accept-invitation";

export const metadata = { title: "Invitación" };

// Página pública del link de invitación. No está bajo /dashboard (no
// requiere negocio): resuelve el estado de la invitación y, según la
// sesión, ofrece crear cuenta, iniciar sesión o aceptar.
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [state, session] = await Promise.all([getInvitationByToken(token), auth.api.getSession({ headers: await headers() })]);
  const here = `/invitacion/${token}`;

  let body: React.ReactNode;
  if (state.status === "invalid") {
    body = <Message title="Link inválido" text="Este link de invitación no existe. Revisá que lo hayas copiado completo." />;
  } else if (state.status !== "pending") {
    const text = {
      expired: "La invitación venció. Pedile a quien te invitó que te la reenvíe.",
      revoked: "Esta invitación fue cancelada.",
      accepted: "Esta invitación ya fue usada.",
    }[state.status];
    body = (
      <Message title={`Invitación a ${state.businessName}`} text={text}>
        {state.status === "accepted" && session && (
          <Link href="/dashboard">
            <Button className="mt-4 w-full">Ir a Nodo</Button>
          </Link>
        )}
      </Message>
    );
  } else {
    const summary = (
      <>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Invitación</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Sumate a {state.businessName}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {state.inviterName ? `${state.inviterName} te invitó` : "Te invitaron"} como <strong>{ROLE_LABELS[state.role]}</strong> con acceso a{" "}
          {state.products.map((p) => PRODUCT_LABELS[p]).join(" y ")}.
        </p>
        <p className="mt-1 text-xs text-slate-500">{ROLE_HINTS[state.role]}</p>
      </>
    );

    if (!session) {
      const existing = await prisma.user.findUnique({ where: { email: state.email }, select: { id: true } });
      const qs = new URLSearchParams({ next: here, email: state.email }).toString();
      body = (
        <>
          {summary}
          <p className="mt-5 text-sm text-slate-600">
            La invitación es para <strong>{state.email}</strong>. {existing ? "Iniciá sesión con ese email para aceptarla." : "Creá tu cuenta con ese email para aceptarla."}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Link href={`${existing ? "/login" : "/registro"}?${qs}`}>
              <Button className="w-full">{existing ? "Iniciar sesión" : "Crear cuenta"}</Button>
            </Link>
            <Link href={`${existing ? "/registro" : "/login"}?${qs}`} className="text-center text-xs font-medium text-brand-700 hover:underline">
              {existing ? "No tengo cuenta" : "Ya tengo cuenta"}
            </Link>
          </div>
        </>
      );
    } else if (session.user.email.toLowerCase() !== state.email) {
      body = (
        <>
          {summary}
          <p className="mt-5 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            Estás con la sesión de <strong>{session.user.email}</strong>, pero la invitación es para <strong>{state.email}</strong>. Cerrá
            sesión y entrá con el email invitado.
          </p>
          <AcceptInvitation token={token} mode="switch" email={state.email} />
        </>
      );
    } else {
      const membership = await prisma.membership.findFirst({ where: { userId: session.user.id }, select: { businessId: true } });
      if (membership && membership.businessId !== state.businessId) {
        body = (
          <>
            {summary}
            <p className="mt-5 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
              Tu cuenta ya pertenece a otro negocio. Por ahora cada usuario puede estar en un solo negocio: pedile a quien te invitó que use
              otro email.
            </p>
          </>
        );
      } else {
        body = (
          <>
            {summary}
            <AcceptInvitation token={token} mode="accept" email={state.email} nodoAccess={state.products.includes("crm")} />
          </>
        );
      }
    }
  }

  return (
    <main className="app-backdrop flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="glass rounded-[var(--radius-glass)] p-8">{body}</div>
      </div>
    </main>
  );
}

function Message({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="text-center">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
      {children}
    </div>
  );
}
