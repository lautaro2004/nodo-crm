"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { HtmlPreview } from "@/components/email/html-preview";

const ERRORS: Record<string, string> = {
  recipient_missing: "Esta ficha no tiene un email de destino.",
  unresolved_variables: "Quedan variables sin resolver ({{...}}). Reemplazalas antes de enviar.",
  email_not_configured: "Falta configurar el remitente en Configuración → Email.",
  provider_unavailable: "El proveedor de email no está disponible en el servidor.",
};

type Result = { kind: "ok" | "error"; text: string };

export function SendEmailAction({
  entityType,
  entityId,
  templates,
}: {
  entityType: "contact" | "lead" | "opportunity";
  entityId: string;
  templates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [recipient, setRecipient] = useState<{ email: string; name: string } | null>(null);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  function close() {
    setOpen(false);
    setTemplateId("");
    setLoaded(false);
    setResult(null);
    setSubject("");
    setBodyHtml("");
  }

  async function chooseTemplate(id: string) {
    setTemplateId(id);
    setResult(null);
    setLoaded(false);
    if (!id) return;
    const res = await fetch("/api/email/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, templateId: id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setResult({ kind: "error", text: ERRORS[data.error] ?? "No se pudo cargar la plantilla." });
    setSubject(data.subject);
    setBodyHtml(data.bodyHtml);
    setRecipient(data.recipient);
    setUnresolved(data.unresolved);
    setLoaded(true);
  }

  async function send() {
    setSending(true);
    setResult(null);
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, subject, bodyHtml }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (data.status === "sent") setResult({ kind: "ok", text: `Correo enviado a ${data.to}.` });
    else if (data.status === "simulated")
      setResult({ kind: "ok", text: `Envío simulado a ${data.to} (proveedor en modo prueba: no se entregó ningún correo). Quedó registrado en el historial.` });
    else if (data.status === "failed") setResult({ kind: "error", text: `El proveedor rechazó el envío (${data.error}). Quedó registrado en el historial.` });
    else setResult({ kind: "error", text: ERRORS[data.error] ?? "No se pudo enviar el correo." });
    if (data.status) router.refresh();
  }

  const done = result?.kind === "ok";
  const canSend = loaded && !!recipient && !sending && !done;

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Enviar correo
      </Button>
      <Modal open={open} onClose={close} title="Enviar correo" maxWidth="max-w-2xl">
        {templates.length === 0 ? (
          <p className="text-sm text-slate-600">
            Todavía no hay plantillas. Creá una en{" "}
            <Link href="/dashboard/configuracion/plantillas/nueva" className="text-indigo-600 underline">
              Configuración → Plantillas
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="tpl">Plantilla</Label>
              <Select id="tpl" value={templateId} onChange={(e) => chooseTemplate(e.target.value)} disabled={done}>
                <option value="">Elegí una plantilla…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>

            {loaded && (
              <>
                <p className="text-sm text-slate-600">
                  Para: {recipient ? <span className="font-medium text-slate-900">{recipient.name} &lt;{recipient.email}&gt;</span> : <span className="text-red-600">sin email de destino</span>}
                </p>
                {unresolved.length > 0 && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    No hay datos para: {unresolved.map((u) => `{{${u}}}`).join(", ")}. Editá el texto antes de enviar.
                  </p>
                )}
                <div>
                  <Label htmlFor="subj">Asunto</Label>
                  <Input id="subj" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={done} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="body">Cuerpo (HTML)</Label>
                    <Textarea id="body" rows={9} className="font-mono text-xs" value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} disabled={done} />
                  </div>
                  <div>
                    <Label>Vista previa</Label>
                    <HtmlPreview html={bodyHtml} className="h-[13.5rem]" />
                  </div>
                </div>
              </>
            )}

            {result && <p className={`text-sm ${result.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>{result.text}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>
                {done ? "Cerrar" : "Cancelar"}
              </Button>
              {!done && (
                <Button onClick={send} disabled={!canSend}>
                  {sending ? "Enviando…" : "Enviar"}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
