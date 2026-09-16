"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, Input, Label, Spinner } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";
import { INDUSTRY_OPTIONS, type IndustryKey } from "@/lib/industry-templates";

// Un único paso (nombre del negocio si hace falta + rubro), enviados
// juntos: evita el caso borde de crear el Workspace sin industria todavía
// y que la página de onboarding redirija sola a /dashboard antes de
// terminar (ver docs/architecture/crm-fase3-core.md, "Onboarding").
export function OnboardingForm({ needsBusinessName }: { needsBusinessName: boolean }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState<IndustryKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!industry) {
      setError("Elegí el tipo de negocio para continuar.");
      return;
    }
    setLoading(true);
    setError(null);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName: needsBusinessName ? businessName : undefined, industry }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("No pudimos crear tu Workspace. Probá de nuevo.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <Card className="p-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Bienvenido a Nodo</h1>
        <p className="mt-1 text-sm text-slate-500">Un par de datos para dejar tu Workspace listo.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {needsBusinessName && (
            <div>
              <Label htmlFor="businessName">Nombre de tu negocio</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ej: Ferretería Centro"
                required
              />
            </div>
          )}

          <div>
            <Label>¿Qué tipo de negocio tenés?</Label>
            <div className="grid grid-cols-2 gap-2">
              {INDUSTRY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIndustry(opt.value)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    industry === opt.value
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Spinner />}
            {loading ? "Creando tu Workspace…" : "Empezar a usar Nodo"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
