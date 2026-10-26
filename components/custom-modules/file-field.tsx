"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/primitives";
import { DownloadIcon, FileIcon } from "@/components/ui/icons";
import { readApiError } from "@/lib/error-messages";
import { apiFetch } from "@/lib/api-fetch";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.zip,.jpg,.jpeg,.png,.webp,.gif";
const ALLOWED_EXT = new Set(ACCEPT.split(",").map((e) => e.slice(1)));
export const MAX_FILE_MB = 20;

/** Validación previa en el navegador (la autoritativa es la del servidor). */
export function checkDocumentFile(file: File): string | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!ALLOWED_EXT.has(ext)) return "Formato no permitido. Usá PDF, Word, Excel, ZIP o una imagen.";
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `El archivo supera los ${MAX_FILE_MB} MB.`;
  return null;
}

// Campo archivo (ej. documentación de una Colaboración). Mismo flujo que
// ImageField: con `uploadUrl` (registro ya creado) sube al elegir; sin él
// (alta) guarda el archivo para subirlo después de crear el registro. La
// descarga pasa por la API (GET), que verifica permisos y redirige a una
// URL firmada de corta duración.
export function FileField({
  id,
  fileName,
  uploadUrl,
  onPending,
}: {
  id: string;
  fileName: string | null;
  uploadUrl?: string;
  onPending?: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(fileName);
  const [uploaded, setUploaded] = useState<boolean>(!!fileName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File) {
    setError(null);
    const problem = checkDocumentFile(file);
    if (problem) return setError(problem);
    if (!uploadUrl) {
      setName(file.name);
      setUploaded(false);
      onPending?.(file);
      return;
    }
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    const res = await apiFetch(uploadUrl, { method: "POST", body });
    setBusy(false);
    if (!res.ok) return setError(await readApiError(res));
    const json = (await res.json().catch(() => null)) as { name?: string } | null;
    setName(json?.name ?? file.name);
    setUploaded(true);
  }

  async function remove() {
    setError(null);
    if (uploadUrl && uploaded) {
      setBusy(true);
      const res = await apiFetch(uploadUrl, { method: "DELETE" });
      setBusy(false);
      if (!res.ok) return setError(await readApiError(res));
    }
    onPending?.(null);
    setName(null);
    setUploaded(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-inset ring-slate-200">
          <FileIcon className="h-4 w-4 shrink-0 text-slate-400" />
          {name ? (
            uploaded && uploadUrl ? (
              <a href={uploadUrl} className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-800 hover:underline">
                <span className="truncate">{name}</span>
                <DownloadIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </a>
            ) : (
              <span className="truncate text-sm text-slate-800">{name}</span>
            )
          ) : (
            <span className="text-sm text-slate-400">Sin archivo</span>
          )}
        </div>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void choose(f);
            e.target.value = "";
          }}
        />
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Subiendo…" : name ? "Reemplazar" : "Subir archivo"}
        </Button>
        {name && !busy && (
          <button type="button" onClick={remove} className="text-xs text-red-500 hover:text-red-700">
            Quitar
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">PDF, Word, Excel, ZIP o imagen · hasta {MAX_FILE_MB} MB</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
