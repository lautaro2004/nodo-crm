import Link from "next/link";

import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/primitives";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">El CRM de Kodexa</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">
          Empresas, contactos, leads y oportunidades — en un solo lugar, conectado con el resto del ecosistema Kodexa.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/login">
            <Button>Iniciar sesión</Button>
          </Link>
          <Link href="/registro">
            <Button variant="secondary">Crear cuenta</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
