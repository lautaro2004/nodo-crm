import { redirect } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default async function OnboardingPage() {
  const ctx = await resolveWorkspaceContext();

  if (ctx.status === "unauthenticated") redirect("/login");
  if (ctx.status === "ok") redirect("/dashboard");

  return (
    <main className="app-backdrop flex min-h-screen items-center justify-center px-4">
      <OnboardingForm needsBusinessName={ctx.status === "no_business"} />
    </main>
  );
}
