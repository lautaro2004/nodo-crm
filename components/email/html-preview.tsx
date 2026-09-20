// Preview aislado: iframe con sandbox vacío (sin scripts, sin same-origin),
// así el HTML de una plantilla nunca se ejecuta dentro de la app.
export function HtmlPreview({ html, className }: { html: string; className?: string }) {
  return (
    <iframe
      title="Vista previa"
      sandbox=""
      srcDoc={`<!doctype html><meta charset="utf-8"><base target="_blank"><body style="font-family:system-ui,sans-serif;font-size:14px;color:#0f172a;margin:12px">${html}</body>`}
      className={`w-full rounded-lg border border-slate-200 bg-white ${className ?? "h-56"}`}
    />
  );
}
