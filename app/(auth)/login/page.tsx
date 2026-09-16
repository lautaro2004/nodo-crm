import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { Card } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <Card className="p-8">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-slate-500">Entrá a tu Workspace de Nodo.</p>
          <div className="mt-6">
            <AuthForm mode="login" />
          </div>
        </Card>
        <p className="mt-6 text-center text-sm text-slate-500">
          ¿No tenés cuenta?{" "}
          <Link href="/registro" className="font-medium text-indigo-600 hover:text-indigo-500">
            Crear una
          </Link>
        </p>
      </div>
    </main>
  );
}
