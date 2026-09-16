import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { Card } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";

export default function RegistroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <Card className="p-8">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Crear cuenta</h1>
          <p className="mt-1 text-sm text-slate-500">
            Misma identidad que Nexo — si ya tenés cuenta, iniciá sesión en vez de crear una nueva.
          </p>
          <div className="mt-6">
            <AuthForm mode="registro" />
          </div>
        </Card>
        <p className="mt-6 text-center text-sm text-slate-500">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
