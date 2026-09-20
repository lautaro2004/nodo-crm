"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card } from "@/components/ui/primitives";

interface Attachment {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  createdAt: Date;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskAttachments({ taskId, attachments }: { taskId: string; attachments: Attachment[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", body: formData });

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(
        data?.error === "file_type_not_allowed"
          ? "Ese tipo de archivo no está permitido (PDF, Word, Excel, imágenes o ZIP)."
          : data?.error === "file_too_large"
            ? "El archivo supera el tamaño máximo permitido (20MB)."
            : "No pudimos subir el archivo."
      );
      return;
    }
    router.refresh();
  }

  async function handleDownload(attachmentId: string) {
    setPendingId(attachmentId);
    const res = await fetch(`/api/tasks/attachments/${attachmentId}`);
    setPendingId(null);
    if (!res.ok) {
      setError("No pudimos generar el link de descarga.");
      return;
    }
    const { url } = await res.json();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(attachmentId: string) {
    setPendingId(attachmentId);
    await fetch(`/api/tasks/attachments/${attachmentId}`, { method: "DELETE" });
    setPendingId(null);
    router.refresh();
  }

  return (
    <div>
      {attachments.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">Sin archivos adjuntos.</p>
      ) : (
        <Card className="mb-3 divide-y divide-slate-100">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-900">{a.fileName}</p>
                <p className="text-xs text-slate-400">
                  {formatSize(a.fileSizeBytes)} · {a.createdAt.toLocaleDateString("es-AR")}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" size="sm" variant="secondary" disabled={pendingId === a.id} onClick={() => handleDownload(a.id)}>
                  Descargar
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={pendingId === a.id} onClick={() => handleDelete(a.id)}>
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
      />
      {uploading && <p className="mt-1 text-xs text-slate-400">Subiendo…</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
