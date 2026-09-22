"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, Input, Label, Spinner } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";
import { INDUSTRY_OPTIONS, INDUSTRY_TEMPLATES, type IndustryKey } from "@/lib/industry-templates";
import { AVAILABLE_MODULES, STATIC_MODULE_LABELS, type AvailableModule } from "@/modules/workspace/available-modules";

type Step = "industry" | "modules";

// Dos pasos en un solo componente (sin navegar de página — mismo criterio
// que ya usaba el onboarding de un paso: evita crear el Workspace a
// medias entre un paso y el siguiente). Paso 1 reutiliza tal cual lo que
// ya existía (nombre + rubro); paso 2 es nuevo: sugiere módulos según el
// rubro elegido y deja editar la selección antes de aplicar nada — recién
// se manda todo junto al confirmar el paso 2 (ver app/api/onboarding/route.ts).
export function OnboardingForm({ needsBusinessName }: { needsBusinessName: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("industry");
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState<IndustryKey | null>(null);
  const [selectedModules, setSelectedModules] = useState<AvailableModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goToModules(e: React.FormEvent) {
    e.preventDefault();
    if (!industry) {
      setError("Elegí el tipo de negocio para continuar.");
      return;
    }
    setError(null);
    setSelectedModules(INDUSTRY_TEMPLATES[industry].activeModules.filter((m): m is AvailableModule => AVAILABLE_MODULES.includes(m as AvailableModule)));
    setStep("modules");
  }

  function toggleModule(key: AvailableModule) {
    setSelectedModules((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
  }

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault();
    if (selectedModules.length === 0) {
      setError("Elegí al menos un módulo para gestionar.");
      return;
    }
    setLoading(true);
    setError(null);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: needsBusinessName ? businessName : undefined,
        industry,
        activeModules: selectedModules,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("No pudimos crear tu Workspace. Probá de nuevo.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const template = industry ? INDUSTRY_TEMPLATES[industry] : null;

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <Card className="p-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Bienvenido a Nodo</h1>
        <p className="mt-1 text-sm text-slate-500">
          {step === "industry" ? "Un par de datos para dejar tu Workspace listo." : "Podés cambiar esta selección cuando quieras desde Configuración."}
        </p>

        {step === "industry" ? (
          <form onSubmit={goToModules} className="mt-6 space-y-5">
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

            <Button type="submit" className="w-full">
              Continuar
            </Button>
          </form>
        ) : (
          <form onSubmit={handleFinish} className="mt-6 space-y-5">
            <div>
              <Label>¿Qué querés gestionar?</Label>
              <p className="mb-2 text-xs text-slate-400">Sugerido para {template?.label} — desmarcá lo que no necesites.</p>
              <div className="space-y-2">
                {AVAILABLE_MODULES.map((key) => {
                  const isOpportunity = key === "opportunities";
                  const label = isOpportunity ? template?.moduleLabel.labelPlural : STATIC_MODULE_LABELS[key];
                  return (
                    <label
                      key={key}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${
                        selectedModules.includes(key) ? "border-indigo-200 bg-indigo-50/50" : "border-slate-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedModules.includes(key)}
                        onChange={() => toggleModule(key)}
                        className="mt-0.5 h-4 w-4 accent-indigo-600"
                      />
                      <span>
                        <span className="block font-medium text-slate-900">{label}</span>
                        {isOpportunity && template && (
                          <span className="block text-xs text-slate-500">{template.pipelineStages.map((s) => s.label).join(" → ")}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400">Actividad e historial siempre están disponibles, no son un módulo aparte.</p>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep("industry")} disabled={loading}>
                ← Volver
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading && <Spinner />}
                {loading ? "Creando tu Workspace…" : "Empezar a usar Nodo"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
