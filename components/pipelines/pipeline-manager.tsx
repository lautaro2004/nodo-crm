"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, InlineAlert, Input } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/status/status-badge";
import { ColorSelect } from "@/components/status/color-picker";
import { readApiError } from "@/lib/error-messages";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { stageColorKey } from "@/lib/status-colors";

interface Stage {
  id: string;
  key: string;
  label: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
  color: string | null;
}
interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
}

// Reordenar con botones subir/bajar en vez de drag-and-drop — sin una
// librería de DnD instalada en esta fase (ver crm-fase3-core.md,
// "Decisiones tomadas"), cumple el requisito ("ordenar etapas") sin sumar
// una dependencia nueva solo para esto.
export function PipelineManager({ pipelines }: { pipelines: Pipeline[] }) {
  const router = useRouter();
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newStageLabel, setNewStageLabel] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // Clave de la operación en curso (ej. "create", "add:<pipelineId>",
  // "del:<stageId>"): el feedback va en ese control y no se duplican envíos.
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  async function mutate(key: string, url: string, init: RequestInit, failMessage?: string): Promise<boolean> {
    if (busy) return false;
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      if (!res.ok) {
        setError(failMessage ?? (await readApiError(res)));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Sin conexión. El cambio no se guardó.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function setStageColor(pipelineId: string, stageId: string, color: string) {
    await mutate(`color:${stageId}`, `/api/pipelines/${pipelineId}/stages/${stageId}`, { method: "PATCH", body: JSON.stringify({ color }) });
  }

  async function createPipeline() {
    const name = newPipelineName.trim();
    if (!name) return;
    if (await mutate("create", "/api/pipelines", { method: "POST", body: JSON.stringify({ name }) })) {
      setNewPipelineName("");
      toast.success(`Pipeline “${name}” creado`);
    }
  }

  async function addStage(pipelineId: string) {
    const label = newStageLabel[pipelineId]?.trim();
    if (!label) return;
    const key = label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const ok = await mutate(`add:${pipelineId}`, `/api/pipelines/${pipelineId}/stages`, {
      method: "POST",
      body: JSON.stringify({ key: key || `etapa_${Date.now()}`, label }),
    });
    if (ok) setNewStageLabel((prev) => ({ ...prev, [pipelineId]: "" }));
  }

  async function deleteStage(pipelineId: string, stage: Stage) {
    if (!(await confirm({ title: `¿Borrar la etapa “${stage.label}”?`, tone: "danger" }))) return;
    const ok = await mutate(
      `del:${stage.id}`,
      `/api/pipelines/${pipelineId}/stages/${stage.id}`,
      { method: "DELETE" },
      "No se puede borrar: hay oportunidades en esta etapa. Movelas a otra etapa primero."
    );
    if (ok) toast.success("Etapa borrada");
  }

  async function moveStage(pipeline: Pipeline, index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= pipeline.stages.length) return;
    const ids = pipeline.stages.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await mutate(`move:${pipeline.id}`, `/api/pipelines/${pipeline.id}/stages`, { method: "PATCH", body: JSON.stringify({ stageIds: ids }) });
  }

  return (
    <div className="space-y-6">
      {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Nuevo pipeline</h2>
        <div className="flex gap-2">
          <Input
            value={newPipelineName}
            onChange={(e) => setNewPipelineName(e.target.value)}
            placeholder="Ej: Ventas, Renovaciones…"
          />
          <Button type="button" onClick={createPipeline} loading={busy === "create"} disabled={!newPipelineName.trim()}>
            {busy === "create" ? "Creando…" : "Crear"}
          </Button>
        </div>
      </Card>

      {pipelines.map((pipeline) => (
        <Card key={pipeline.id} className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{pipeline.name}</h2>
            {pipeline.isDefault && <Badge>Default</Badge>}
          </div>

          <ul className="space-y-1">
            {pipeline.stages.map((stage, index) => (
              <li key={stage.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-slate-800">
                  <StatusBadge label={stage.label} color={stageColorKey(stage)} />
                  {stage.isWon && <Badge variant="success">Ganada</Badge>}
                  {stage.isLost && <Badge variant="danger">Perdida</Badge>}
                </span>
                <div className="flex items-center gap-1">
                  <ColorSelect id={stage.id} value={stageColorKey(stage)} onChange={(c) => setStageColor(pipeline.id, stage.id, c)} />
                  <button
                    type="button"
                    onClick={() => moveStage(pipeline, index, -1)}
                    disabled={!!busy || index === 0}
                    aria-label={`Subir ${stage.label}`}
                    className="rounded px-1.5 text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStage(pipeline, index, 1)}
                    disabled={!!busy || index === pipeline.stages.length - 1}
                    aria-label={`Bajar ${stage.label}`}
                    className="rounded px-1.5 text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteStage(pipeline.id, stage)}
                    disabled={!!busy}
                    className="rounded px-1.5 text-red-400 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    {busy === `del:${stage.id}` ? "Borrando…" : "Borrar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex gap-2">
            <Input
              value={newStageLabel[pipeline.id] ?? ""}
              onChange={(e) => setNewStageLabel({ ...newStageLabel, [pipeline.id]: e.target.value })}
              placeholder="Nueva etapa…"
            />
            <Button type="button" variant="secondary" onClick={() => addStage(pipeline.id)} loading={busy === `add:${pipeline.id}`} disabled={!newStageLabel[pipeline.id]?.trim()}>
              Agregar etapa
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
