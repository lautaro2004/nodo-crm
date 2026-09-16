"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, Input } from "@/components/ui/primitives";

interface Stage {
  id: string;
  key: string;
  label: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
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

  async function createPipeline() {
    if (!newPipelineName.trim()) return;
    await fetch("/api/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPipelineName }),
    });
    setNewPipelineName("");
    router.refresh();
  }

  async function addStage(pipelineId: string) {
    const label = newStageLabel[pipelineId]?.trim();
    if (!label) return;
    const key = label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    await fetch(`/api/pipelines/${pipelineId}/stages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key || `etapa_${Date.now()}`, label }),
    });
    setNewStageLabel({ ...newStageLabel, [pipelineId]: "" });
    router.refresh();
  }

  async function deleteStage(pipelineId: string, stageId: string) {
    const res = await fetch(`/api/pipelines/${pipelineId}/stages/${stageId}`, { method: "DELETE" });
    if (!res.ok) {
      alert("No se puede borrar: hay oportunidades en esta etapa.");
      return;
    }
    router.refresh();
  }

  async function moveStage(pipeline: Pipeline, index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= pipeline.stages.length) return;
    const ids = pipeline.stages.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await fetch(`/api/pipelines/${pipeline.id}/stages`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageIds: ids }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Nuevo pipeline</h2>
        <div className="flex gap-2">
          <Input
            value={newPipelineName}
            onChange={(e) => setNewPipelineName(e.target.value)}
            placeholder="Ej: Ventas, Renovaciones…"
          />
          <Button type="button" onClick={createPipeline}>
            Crear
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
              <li key={stage.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="text-sm text-slate-800">
                  {stage.label}
                  {stage.isWon && <Badge className="ml-2">Ganada</Badge>}
                  {stage.isLost && <Badge className="ml-2">Perdida</Badge>}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveStage(pipeline, index, -1)}
                    className="rounded px-1.5 text-slate-400 hover:bg-slate-100"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStage(pipeline, index, 1)}
                    className="rounded px-1.5 text-slate-400 hover:bg-slate-100"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteStage(pipeline.id, stage.id)}
                    className="rounded px-1.5 text-red-400 hover:bg-red-50"
                  >
                    Borrar
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
            <Button type="button" variant="secondary" onClick={() => addStage(pipeline.id)}>
              Agregar etapa
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
