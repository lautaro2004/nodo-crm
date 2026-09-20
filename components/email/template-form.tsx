"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Label, Textarea } from "@/components/ui/primitives";
import { HtmlPreview } from "@/components/email/html-preview";
import { TEMPLATE_VARIABLES, renderTemplate, SAMPLE_VALUES } from "@/modules/email/render";

const ERRORS: Record<string, string> = {
  template_name_taken: "Ya existe una plantilla con ese nombre.",
  email_not_configured: "Configurá primero el remitente en Configuración → Email.",
  provider_unavailable: "El proveedor elegido no está disponible en el servidor.",
};

export function TemplateForm({ templateId, initial }: { templateId?: string; initial?: { name: string; subject: string; bodyHtml: string } }) {
  const router = useRouter();
  const [values, setValues] = useState({ name: initial?.name ?? "", subject: initial?.subject ?? "", bodyHtml: initial?.bodyHtml ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(key: string) {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) return setValues((v) => ({ ...v, bodyHtml: v.bodyHtml + token }));
    const start = el.selectionStart ?? values.bodyHtml.length;
    const end = el.selectionEnd ?? start;
    setValues((v) => ({ ...v, bodyHtml: v.bodyHtml.slice(0, start) + token + v.bodyHtml.slice(end) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const res = await fetch(templateId ? `/api/email/templates/${templateId}` : "/api/email/templates", {
      method: templateId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(ERRORS[data.error] ?? "Revisá los datos e intentá de nuevo.");
      return;
    }
    if (templateId) {
      setInfo("Guardado.");
      router.refresh();
    } else {
      router.push("/dashboard/configuracion/plantillas");
      router.refresh();
    }
  }

  async function sendTest() {
    if (!templateId) return;
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/email/templates/${templateId}/test`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(ERRORS[data.error] ?? "No se pudo enviar la prueba.");
    if (data.status === "failed") return setError(`El proveedor rechazó el envío (${data.error}).`);
    setInfo(
      data.status === "simulated"
        ? `Prueba simulada para ${data.to} (modo prueba: no se entregó ningún correo). Guardá antes para probar los últimos cambios.`
        : `Prueba enviada a ${data.to}. Guardá antes para probar los últimos cambios.`
    );
  }

  async function remove() {
    if (!templateId || !window.confirm("¿Eliminar esta plantilla? Los correos ya enviados no se modifican.")) return;
    await fetch(`/api/email/templates/${templateId}`, { method: "DELETE" });
    router.push("/dashboard/configuracion/plantillas");
    router.refresh();
  }

  const previewSubject = renderTemplate(values.subject, SAMPLE_VALUES).output;
  const previewBody = renderTemplate(values.bodyHtml, SAMPLE_VALUES, { html: true }).output;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Nombre interno *</Label>
          <Input id="name" required value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="subject">Asunto *</Label>
          <Input id="subject" required value={values.subject} onChange={(e) => setValues({ ...values, subject: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="bodyHtml">Cuerpo (HTML) *</Label>
          <div className="mb-1 flex flex-wrap gap-1">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                title={v.label}
                onClick={() => insertVariable(v.key)}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
          <Textarea
            id="bodyHtml"
            ref={bodyRef}
            required
            rows={12}
            className="font-mono text-xs"
            value={values.bodyHtml}
            onChange={(e) => setValues({ ...values, bodyHtml: e.target.value })}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-slate-600">{info}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando…" : templateId ? "Guardar cambios" : "Crear plantilla"}
          </Button>
          {templateId && (
            <>
              <Button type="button" variant="secondary" onClick={sendTest}>
                Enviarme una prueba
              </Button>
              <Button type="button" variant="danger" onClick={remove}>
                Eliminar
              </Button>
            </>
          )}
        </div>
      </form>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Vista previa (datos de ejemplo)</p>
        <p className="mb-2 text-sm font-medium text-slate-900">{previewSubject || "—"}</p>
        <HtmlPreview html={previewBody} className="h-80" />
      </div>
    </div>
  );
}
