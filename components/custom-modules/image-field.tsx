"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/primitives";
import { ImageIcon } from "@/components/ui/icons";
import { readApiError } from "@/lib/error-messages";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
export const MAX_IMAGE_MB = 5;

/** Validación previa en el navegador (la autoritativa es la del servidor). */
export function checkImageFile(file: File): string | null {
  if (!ACCEPT.split(",").includes(file.type)) return "Formato no permitido. Usá JPG, PNG, WebP o GIF.";
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `La imagen supera los ${MAX_IMAGE_MB} MB.`;
  return null;
}

// Campo imagen. Con `uploadUrl` (registro ya creado) sube al elegir; sin
// él (alta) guarda el archivo elegido para subirlo después de crear.
export function ImageField({
  id,
  label,
  url,
  uploadUrl,
  onPending,
}: {
  id: string;
  label: string;
  url: string | null;
  uploadUrl?: string;
  onPending?: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File) {
    setError(null);
    const problem = checkImageFile(file);
    if (problem) return setError(problem);
    const local = URL.createObjectURL(file);
    if (!uploadUrl) {
      setPreview(local);
      onPending?.(file);
      return;
    }
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(uploadUrl, { method: "POST", body });
    setBusy(false);
    if (!res.ok) {
      URL.revokeObjectURL(local);
      return setError(await readApiError(res));
    }
    setPreview((await res.json()).url ?? local);
  }

  async function remove() {
    setError(null);
    if (uploadUrl) {
      setBusy(true);
      const res = await fetch(uploadUrl, { method: "DELETE" });
      setBusy(false);
      if (!res.ok) return setError(await readApiError(res));
    }
    onPending?.(null);
    setPreview(null);
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-inset ring-slate-200">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage / vista previa local
            <img src={preview} alt={label} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-300" />
          )}
        </div>
        <div className="flex flex-col items-start gap-1">
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
            {busy ? "Subiendo…" : preview ? "Cambiar imagen" : "Subir imagen"}
          </Button>
          {preview && !busy && (
            <button type="button" onClick={remove} className="text-xs text-red-500 hover:text-red-700">
              Quitar
            </button>
          )}
          <span className="text-[11px] text-slate-400">JPG, PNG, WebP o GIF · hasta {MAX_IMAGE_MB} MB</span>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
