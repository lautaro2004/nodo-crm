"use client";

import { useMemo, useRef, useState } from "react";

import { Badge, Button, Card, Input, Label, Select, Spinner, Textarea } from "@/components/ui/primitives";
import { UploadIcon } from "@/components/ui/icons";
import { customFieldTypes } from "@/lib/schemas";
import { ImportParseError, parseSpreadsheetFile, type ParsedSheet } from "@/lib/import-parse";
import {
  IMPORT_MODULE_DEFS,
  applyMapping,
  guessColumnType,
  slugifyKey,
  suggestStandardField,
  type ColumnMapping,
  type ImportModule,
  type MappingTarget,
  type RowValidationResult,
} from "@/modules/import/shared";

interface CustomFieldDef {
  id: string;
  key: string;
  label: string;
  type: string;
  options: string[];
}

type Step = "module" | "upload" | "map" | "preview" | "result";

const MODULES: ImportModule[] = ["contact", "company", "lead"];

const CUSTOM_FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  number: "Número",
  currency: "Moneda",
  date: "Fecha",
  datetime: "Fecha y hora",
  boolean: "Sí / No",
  select: "Selección única",
  multiselect: "Selección múltiple",
  email: "Email",
  phone: "Teléfono",
  url: "URL",
};

interface ImportResultDto {
  totalRows: number;
  created: number;
  updated: number;
  errorCount: number;
  errors: { row: number; messages: string[] }[];
}

export function ImportWizard() {
  const [step, setStep] = useState<Step>("module");
  const [module, setModule] = useState<ImportModule | null>(null);
  const [definitions, setDefinitions] = useState<CustomFieldDef[]>([]);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResultDto | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const moduleDef = module ? IMPORT_MODULE_DEFS[module] : null;
  const customLabelByDefinitionId = useMemo(() => new Map(definitions.map((d) => [d.id, d.label])), [definitions]);

  async function chooseModule(next: ImportModule) {
    setModule(next);
    const res = await fetch(`/api/custom-field-definitions?entityType=${IMPORT_MODULE_DEFS[next].entityType}`);
    setDefinitions(res.ok ? await res.json() : []);
    setStep("upload");
  }

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    try {
      const parsed = await parseSpreadsheetFile(file);
      setSheet(parsed);
      const initialMapping: ColumnMapping[] = parsed.headers.map((column) => {
        const suggestion = moduleDef ? suggestStandardField(column, moduleDef) : null;
        const target: MappingTarget = suggestion ? { kind: "standard", fieldKey: suggestion } : { kind: "ignore" };
        return { column, target };
      });
      setMapping(initialMapping);
      setStep("map");
    } catch (err) {
      setParseError(err instanceof ImportParseError ? err.message : "No pudimos leer este archivo.");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function setColumnTarget(column: string, target: MappingTarget) {
    setMapping((prev) => prev.map((m) => (m.column === column ? { ...m, target } : m)));
  }

  function samplesFor(column: string): string[] {
    if (!sheet) return [];
    return sheet.rows.slice(0, 20).map((r) => r[column]).filter(Boolean);
  }

  async function createFieldForColumn(column: string, label: string, type: string, optionsText: string) {
    if (!module || !moduleDef) return;
    const options = type === "select" || type === "multiselect" ? optionsText.split(",").map((o) => o.trim()).filter(Boolean) : [];
    const res = await fetch("/api/custom-field-definitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: moduleDef.entityType, key: slugifyKey(label), label, type, options }),
    });
    if (!res.ok) return;
    const definition: CustomFieldDef = await res.json();
    setDefinitions((prev) => [...prev, definition]);
    setColumnTarget(column, { kind: "custom", definitionId: definition.id, fieldType: definition.type, options: definition.options });
    setCreatingFor(null);
  }

  const preview = useMemo(() => {
    if (!sheet || !moduleDef) return null;
    const results: (RowValidationResult & { fileRow: number })[] = sheet.rows.map((row, i) => ({
      ...applyMapping(row, mapping, moduleDef, customLabelByDefinitionId),
      fileRow: i + 2,
    }));
    const valid = results.filter((r) => r.errors.length === 0);
    const invalid = results.filter((r) => r.errors.length > 0);
    // Los campos personalizados ya se crean en el paso de mapeo (Fase 4:
    // "debe poder mapearse inmediatamente"), así que acá no hay nada
    // "por crear" — sólo se informa cuáles quedaron en uso.
    const customFieldLabels = mapping
      .filter((m): m is { column: string; target: Extract<MappingTarget, { kind: "custom" }> } => m.target.kind === "custom")
      .map((m) => customLabelByDefinitionId.get(m.target.definitionId) ?? m.target.definitionId);
    return { results, valid, invalid, customFieldLabels };
  }, [sheet, mapping, moduleDef, customLabelByDefinitionId]);

  const requiredField = moduleDef?.standardFields.find((f) => f.required);
  const requiredMapped = !requiredField || mapping.some((m) => m.target.kind === "standard" && m.target.fieldKey === requiredField.key);

  async function confirmImport() {
    if (!module || !preview) return;
    setSubmitting(true);
    setSubmitError(null);
    const rows = preview.valid.map((r) => ({ standard: r.standard, custom: r.custom }));
    const res = await fetch(`/api/import/${module}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setSubmitError("No pudimos completar la importación. Intentá de nuevo.");
      return;
    }
    setResult(await res.json());
    setStep("result");
  }

  function downloadErrors() {
    if (!result || result.errors.length === 0) return;
    const lines = ["Fila,Errores", ...result.errors.map((e) => `${e.row},"${e.messages.join(" | ").replace(/"/g, '""')}"`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "errores-importacion.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStep("module");
    setModule(null);
    setDefinitions([]);
    setSheet(null);
    setMapping([]);
    setResult(null);
    setSubmitError(null);
  }

  return (
    <div className="max-w-4xl space-y-6">
      {step === "module" && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">1. Elegí qué querés importar</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MODULES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => chooseModule(m)}
                className="rounded-xl border border-slate-200 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/50"
              >
                <p className="text-sm font-semibold text-slate-900">{IMPORT_MODULE_DEFS[m].label}</p>
                <p className="mt-0.5 text-xs text-slate-500">Desde un archivo .csv o .xlsx</p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === "upload" && moduleDef && (
        <Card className="p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">2. Subí el archivo — {moduleDef.label}</h2>
          <p className="mb-4 text-xs text-slate-500">CSV o XLSX, hasta 5&nbsp;MB y 2000 filas.</p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-10 text-center hover:border-indigo-300">
            <UploadIcon className="h-6 w-6 text-slate-400" />
            <span className="text-sm text-slate-600">{parsing ? "Leyendo archivo…" : "Hacé clic para elegir un archivo"}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              disabled={parsing}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
          {parsing && <Spinner className="mx-auto mt-3" />}
          {parseError && <p className="mt-3 text-sm text-red-600">{parseError}</p>}
          <Button variant="ghost" className="mt-4" onClick={() => setStep("module")}>
            ← Elegir otro módulo
          </Button>
        </Card>
      )}

      {step === "map" && sheet && moduleDef && (
        <Card className="p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">3. Mapeá las columnas</h2>
          <p className="mb-4 text-xs text-slate-500">
            {sheet.headers.length} columnas · {sheet.rows.length} filas detectadas en el archivo.
          </p>
          <div className="space-y-2">
            {sheet.headers.map((column) => {
              const entry = mapping.find((m) => m.column === column)!;
              const sample = samplesFor(column)[0] ?? "";
              return (
                <div key={column} className="rounded-lg border border-slate-100 p-3">
                  <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1fr_1fr]">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{column}</p>
                      {sample && <p className="truncate text-xs text-slate-400">ej.: {sample}</p>}
                    </div>
                    <Select
                      value={mappingSelectValue(entry.target)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "ignore") setColumnTarget(column, { kind: "ignore" });
                        else if (v === "new") setCreatingFor(column);
                        else if (v.startsWith("std:")) setColumnTarget(column, { kind: "standard", fieldKey: v.slice(4) });
                        else if (v.startsWith("custom:")) {
                          const def = definitions.find((d) => d.id === v.slice(7));
                          if (def) setColumnTarget(column, { kind: "custom", definitionId: def.id, fieldType: def.type, options: def.options });
                        }
                      }}
                    >
                      <option value="ignore">Ignorar columna</option>
                      <optgroup label="Campos existentes">
                        {moduleDef.standardFields.map((f) => (
                          <option key={f.key} value={`std:${f.key}`}>
                            {f.label}
                            {f.required ? " *" : ""}
                          </option>
                        ))}
                        {definitions.map((d) => (
                          <option key={d.id} value={`custom:${d.id}`}>
                            {d.label}
                          </option>
                        ))}
                      </optgroup>
                      <option value="new">+ Crear campo…</option>
                    </Select>
                    <div>
                      {entry.target.kind === "standard" && <Badge variant="brand">Campo estándar</Badge>}
                      {entry.target.kind === "custom" && <Badge variant="success">Personalizado</Badge>}
                      {entry.target.kind === "ignore" && <Badge variant="neutral">Ignorada</Badge>}
                    </div>
                  </div>

                  {creatingFor === column && (
                    <NewFieldForm
                      column={column}
                      guessedType={guessColumnType(samplesFor(column))}
                      onCancel={() => setCreatingFor(null)}
                      onCreate={(label, type, options) => createFieldForColumn(column, label, type, options)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep("upload")}>
              ← Volver
            </Button>
            <div className="text-right">
              {!requiredMapped && requiredField && (
                <p className="mb-1 text-xs text-red-600">Mapeá una columna a &quot;{requiredField.label}&quot; para continuar.</p>
              )}
              <Button disabled={!requiredMapped} onClick={() => setStep("preview")}>
                Ver preview →
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === "preview" && preview && moduleDef && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">4. Preview</h2>
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-2xl font-semibold text-slate-900">{preview.results.length}</p>
              <p className="text-xs text-slate-500">registros detectados</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-2xl font-semibold text-emerald-700">{preview.valid.length}</p>
              <p className="text-xs text-emerald-700">válidos</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-2xl font-semibold text-red-700">{preview.invalid.length}</p>
              <p className="text-xs text-red-700">con errores</p>
            </div>
          </div>

          {preview.customFieldLabels.length > 0 && (
            <p className="mb-4 text-xs text-slate-500">
              Campos personalizados usados: {preview.customFieldLabels.map((l) => `"${l}"`).join(", ")}.
            </p>
          )}

          {preview.valid.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Ejemplos</p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {preview.valid.slice(0, 5).map((r, i) => (
                  <li key={i} className="px-3 py-2 text-sm text-slate-700">
                    {Object.entries(r.standard)
                      .map(([, v]) => v)
                      .join(" · ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.invalid.length > 0 && (
            <details className="mb-4">
              <summary className="cursor-pointer text-sm font-medium text-red-700">Ver {preview.invalid.length} filas con errores</summary>
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-red-100 bg-red-50/50 p-2 text-xs text-red-800">
                {preview.invalid.map((r) => (
                  <li key={r.fileRow}>
                    Fila {r.fileRow}: {r.errors.join("; ")}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {submitError && <p className="mb-3 text-sm text-red-600">{submitError}</p>}

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep("map")}>
              ← Volver a mapear
            </Button>
            <Button disabled={preview.valid.length === 0 || submitting} onClick={confirmImport}>
              {submitting ? "Importando…" : `Confirmar importación (${preview.valid.length})`}
            </Button>
          </div>
        </Card>
      )}

      {step === "result" && result && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Importación completada</h2>
          <div className="mb-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xl font-semibold text-slate-900">{result.totalRows}</p>
              <p className="text-xs text-slate-500">procesadas</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xl font-semibold text-emerald-700">{result.created}</p>
              <p className="text-xs text-emerald-700">creadas</p>
            </div>
            <div className="rounded-lg bg-indigo-50 p-3">
              <p className="text-xl font-semibold text-indigo-700">{result.updated}</p>
              <p className="text-xs text-indigo-700">actualizadas</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-xl font-semibold text-red-700">{result.errorCount}</p>
              <p className="text-xs text-red-700">con errores</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Detalle de errores</p>
                <Button variant="secondary" size="sm" onClick={downloadErrors}>
                  Descargar CSV
                </Button>
              </div>
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-red-100 bg-red-50/50 p-2 text-xs text-red-800">
                {result.errors.map((e) => (
                  <li key={e.row}>
                    Fila {e.row}: {e.messages.join("; ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button onClick={reset}>Importar otro archivo</Button>
        </Card>
      )}
    </div>
  );
}

function mappingSelectValue(target: MappingTarget): string {
  if (target.kind === "ignore") return "ignore";
  if (target.kind === "standard") return `std:${target.fieldKey}`;
  return `custom:${target.definitionId}`;
}

function NewFieldForm({
  column,
  guessedType,
  onCreate,
  onCancel,
}: {
  column: string;
  guessedType: string;
  onCreate: (label: string, type: string, options: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(column);
  const [type, setType] = useState(guessedType);
  const [options, setOptions] = useState("");

  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-3">
      <p className="mb-2 text-xs text-slate-600">
        Este campo no existe en Nodo todavía. Se sugiere el tipo <strong>{CUSTOM_FIELD_TYPE_LABELS[guessedType]}</strong> según los datos de la columna.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <Label htmlFor={`label-${column}`}>Nombre</Label>
          <Input id={`label-${column}`} value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`type-${column}`}>Tipo</Label>
          <Select id={`type-${column}`} value={type} onChange={(e) => setType(e.target.value)}>
            {customFieldTypes.map((t) => (
              <option key={t} value={t}>
                {CUSTOM_FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        {(type === "select" || type === "multiselect") && (
          <div>
            <Label htmlFor={`options-${column}`}>Opciones (separadas por coma)</Label>
            <Textarea id={`options-${column}`} rows={1} value={options} onChange={(e) => setOptions(e.target.value)} />
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={!label.trim()} onClick={() => onCreate(label.trim(), type, options)}>
          Crear campo
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
