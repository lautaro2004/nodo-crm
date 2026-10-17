import { redirect } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default async function OnboardingPage() {
  const ctx = await resolveWorkspaceContext();

  if (ctx.status === "unauthenticated") redirect("/login");
  if (ctx.status === "ok" || ctx.status === "no_access") redirect("/dashboard");
  if (ctx.status === "no_workspace" && ctx.role !== "owner") {
    return (
      <main className="app-backdrop flex min-h-screen items-center justify-center px-4">
        <div className="glass max-w-md rounded-[var(--radius-glass)] p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Nodo todavía no está activado</h1>
          <p className="mt-2 text-sm text-slate-600">El dueño del negocio tiene que activar Nodo antes de que puedas usarlo.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-backdrop flex min-h-screen items-center justify-center px-4">
      <OnboardingForm needsBusinessName={ctx.status === "no_business"} />
    </main>
  );
}
