import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { safeNext } from "@/lib/safe-next";
import { Logo } from "@/components/ui/logo";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const { next, email } = await searchParams;
  const qs = new URLSearchParams(Object.entries({ next: safeNext(next) ?? "", email: email ?? "" }).filter(([, v]) => v)).toString();
  return (
    <main className="app-backdrop flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="glass rounded-[var(--radius-glass)] p-8">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-slate-500">Entrá a tu Workspace de Nodo.</p>
          <div className="mt-6">
            <AuthForm mode="login" next={safeNext(next)} defaultEmail={email} />
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          ¿No tenés cuenta?{" "}
          <Link href={qs ? `/registro?${qs}` : "/registro"} className="font-medium text-brand-700 hover:text-brand-800">
            Crear una
          </Link>
        </p>
      </div>
    </main>
  );
}
