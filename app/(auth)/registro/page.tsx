import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { safeNext } from "@/lib/safe-next";
import { Logo } from "@/components/ui/logo";

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const { next, email } = await searchParams;
  const qs = new URLSearchParams(Object.entries({ next: safeNext(next) ?? "", email: email ?? "" }).filter(([, v]) => v)).toString();
  return (
    <main className="app-backdrop flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="glass rounded-[var(--radius-glass)] p-8">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Crear cuenta</h1>
          <p className="mt-1 text-sm text-slate-500">
            Misma identidad que Nexo — si ya tenés cuenta, iniciá sesión en vez de crear una nueva.
          </p>
          <div className="mt-6">
            <AuthForm mode="registro" next={safeNext(next)} defaultEmail={email} />
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          ¿Ya tenés cuenta?{" "}
          <Link href={qs ? `/login?${qs}` : "/login"} className="font-medium text-brand-700 hover:text-brand-800">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
