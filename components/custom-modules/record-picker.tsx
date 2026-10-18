"use client";

import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/primitives";
import { XIcon } from "@/components/ui/icons";

export interface PickedRecord {
  id: string;
  label: string;
}

export interface RecordOption extends PickedRecord {
  sub?: string | null;
  price?: number | null;
  priceText?: string | null;
  imageUrl?: string | null;
}
type Option = RecordOption;

// Selector de registros existentes (contactos, empresas, oportunidades o
// registros de un módulo) para campos "relation". Busca en el servidor
// (scopeado al negocio); nunca crea ni copia registros.
export function RecordPicker({
  id,
  targetEntity,
  multiple,
  value,
  onChange,
  placeholder = "Buscar…",
}: {
  id: string;
  targetEntity: string;
  multiple: boolean;
  value: PickedRecord[];
  onChange: (value: PickedRecord[]) => void;
  placeholder?: string;
}) {
  return <RecordSearchBox id={id} targetEntity={targetEntity} multiple={multiple} value={value} onChange={onChange} placeholder={placeholder} />;
}

/** Igual que RecordPicker pero avisa la opción completa (precio, imagen). */
export function RecordSearchBox({
  id,
  targetEntity,
  multiple,
  value,
  onChange,
  onPickOption,
  placeholder = "Buscar…",
}: {
  id: string;
  targetEntity: string;
  multiple: boolean;
  value: PickedRecord[];
  onChange: (value: PickedRecord[]) => void;
  onPickOption?: (option: RecordOption) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/records/search?type=${encodeURIComponent(targetEntity)}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        setOptions(res.ok ? await res.json() : []);
      } catch {
        /* abortado */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open, targetEntity]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(o: Option) {
    if (value.some((v) => v.id === o.id)) return;
    onPickOption?.(o);
    onChange(multiple ? [...value, { id: o.id, label: o.label }] : [{ id: o.id, label: o.label }]);
    setQ("");
    if (!multiple) setOpen(false);
  }

  const showInput = multiple || value.length === 0;

  return (
    <div ref={boxRef} className="relative">
      {value.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1 text-xs font-medium text-slate-700">
              <span className="truncate">{v.label}</span>
              <button
                type="button"
                aria-label={`Quitar ${v.label}`}
                onClick={() => onChange(value.filter((x) => x.id !== v.id))}
                className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {showInput && (
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          value={q}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              e.preventDefault();
              const first = options.find((o) => !value.some((v) => v.id === o.id));
              if (first) pick(first);
            }
          }}
        />
      )}
      {open && showInput && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {loading && options.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Buscando…</li>}
          {!loading && options.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Sin resultados</li>}
          {options.map((o) => {
            const chosen = value.some((v) => v.id === o.id);
            return (
              <li key={o.id} role="option" aria-selected={chosen}>
                <button
                  type="button"
                  disabled={chosen}
                  onClick={() => pick(o)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40"
                >
                  {o.imageUrl !== undefined && (
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200">
                      {o.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage
                        <img src={o.imageUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-800">{o.label}</span>
                    {o.sub && <span className="block truncate text-xs text-slate-500">{o.sub}</span>}
                  </span>
                  {o.priceText && <span className="shrink-0 tabular-nums text-xs text-slate-600">{o.priceText}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
