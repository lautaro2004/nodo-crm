"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, Input, Select } from "@/components/ui/primitives";
import { RecordSearchBox, type RecordOption } from "@/components/custom-modules/record-picker";
import { readApiError } from "@/lib/error-messages";
import { apiFetch } from "@/lib/api-fetch";

interface Item {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  href: string | null;
  imageUrl: string | null;
  /** Precio actual del catálogo, si cambió respecto del aplicado. */
  catalogPrice: number | null;
}

const money = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

// Productos de una oportunidad. Opción B: el valor de la oportunidad es
// manual; acá se muestra el total de los productos y el botón "Usar total
// de productos" lo aplica explícitamente. Los precios son históricos.
export function OpportunityItemsCard({
  opportunityId,
  open,
  amount,
  items,
  modules,
}: {
  opportunityId: string;
  open: boolean;
  amount: number | null;
  items: Item[];
  modules: { id: string; labelPlural: string; labelSingular: string }[];
}) {
  const router = useRouter();
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { quantity: string; unitPrice: string }>>({});
  const total = Math.round(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 100) / 100;
  const base = `/api/opportunities/${opportunityId}/items`;

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    const res = await apiFetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    setBusy(false);
    if (!res.ok) {
      setError(await readApiError(res));
      return false;
    }
    router.refresh();
    return true;
  }

  async function add(option: RecordOption) {
    await call(base, { method: "POST", body: JSON.stringify({ recordId: option.id }) });
  }

  async function saveDraft(item: Item) {
    const d = drafts[item.id];
    if (!d) return;
    const quantity = Number(d.quantity.replace(",", "."));
    const unitPrice = Number(d.unitPrice.replace(",", "."));
    if (!(quantity > 0) || !(unitPrice >= 0)) return setError("Revisá cantidad y precio.");
    if (await call(`${base}/${item.id}`, { method: "PATCH", body: JSON.stringify({ quantity, unitPrice }) })) {
      setDrafts((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== item.id)));
    }
  }

  if (items.length === 0 && (!open || modules.length === 0)) {
    if (modules.length === 0 && open) {
      return (
        <Card className="p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Productos</h2>
          <p className="text-sm text-slate-500">
            Para sumar productos, creá un módulo con un campo de precio (por ejemplo con la plantilla “Productos”) en{" "}
            <Link href="/dashboard/configuracion/modulos" className="text-brand-700 hover:underline">
              Configuración → Módulos
            </Link>
            .
          </p>
        </Card>
      );
    }
    return null;
  }

  const diff = amount === null ? null : Math.round((total - amount) * 100) / 100;

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Productos</h2>
        {!open && <span className="text-xs text-slate-500">Oportunidad cerrada: precios e importes históricos, no se recalculan.</span>}
      </div>

      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <th className="py-2 pr-2">Producto</th>
                <th className="w-24 px-2 py-2 text-right">Cant.</th>
                <th className="w-32 px-2 py-2 text-right">Precio aplicado</th>
                <th className="w-28 px-2 py-2 text-right">Subtotal</th>
                {open && <th className="w-16" />}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const d = drafts[item.id];
                const q = d ? Number(d.quantity.replace(",", ".")) || 0 : item.quantity;
                const p = d ? Number(d.unitPrice.replace(",", ".")) || 0 : item.unitPrice;
                return (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2.5">
                        <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200">
                          {item.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage
                            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                          )}
                        </span>
                        <div className="min-w-0">
                          {item.href ? (
                            <Link href={item.href} className="block truncate font-medium text-slate-800 hover:text-brand-700">
                              {item.name}
                            </Link>
                          ) : (
                            <span className="block truncate font-medium text-slate-800">{item.name}</span>
                          )}
                          {item.catalogPrice !== null && item.catalogPrice !== item.unitPrice && (
                            <span className="text-xs text-slate-500">Precio actual del catálogo: {money(item.catalogPrice)}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {open ? (
                        <Input
                          aria-label={`Cantidad de ${item.name}`}
                          inputMode="decimal"
                          className="w-20 px-2 py-1 text-right"
                          value={d?.quantity ?? String(item.quantity)}
                          onChange={(e) => setDrafts((s) => ({ ...s, [item.id]: { quantity: e.target.value, unitPrice: s[item.id]?.unitPrice ?? String(item.unitPrice) } }))}
                        />
                      ) : (
                        <span className="tabular-nums">{item.quantity}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {open ? (
                        <Input
                          aria-label={`Precio de ${item.name}`}
                          inputMode="decimal"
                          className="w-28 px-2 py-1 text-right"
                          value={d?.unitPrice ?? String(item.unitPrice)}
                          onChange={(e) => setDrafts((s) => ({ ...s, [item.id]: { quantity: s[item.id]?.quantity ?? String(item.quantity), unitPrice: e.target.value } }))}
                        />
                      ) : (
                        <span className="tabular-nums">{money(item.unitPrice)}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-800">{money(q * p)}</td>
                    {open && (
                      <td className="py-2 pl-2 text-right">
                        {d ? (
                          <button type="button" disabled={busy} onClick={() => saveDraft(item)} className="text-xs font-medium text-brand-700 hover:underline">
                            Guardar
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`Quitar ${item.name}`}
                            onClick={() => call(`${base}/${item.id}`, { method: "DELETE" })}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Quitar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="text-sm">
            <span className="text-slate-500">Total de productos: </span>
            <span className="font-semibold tabular-nums text-slate-900">{money(total)}</span>
            <span className="ml-3 text-slate-500">Valor de la oportunidad: </span>
            <span className="tabular-nums text-slate-800">{amount === null ? "—" : money(amount)}</span>
          </div>
          {open && diff !== 0 && (
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => call(`${base}/apply-total`, { method: "POST" })}>
              Usar total de productos
            </Button>
          )}
        </div>
      )}

      {open && modules.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {modules.length > 1 && (
            <Select aria-label="Módulo" value={moduleId} onChange={(e) => setModuleId(e.target.value)} className="sm:w-48">
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.labelPlural}
                </option>
              ))}
            </Select>
          )}
          <div className="flex-1">
            <RecordSearchBox
              key={moduleId}
              id="add-item"
              targetEntity={`cm:${moduleId}`}
              multiple={false}
              value={[]}
              onChange={() => undefined}
              onPickOption={(o) => void add(o)}
              placeholder={`Agregar ${modules.find((m) => m.id === moduleId)?.labelSingular.toLowerCase() ?? "producto"}…`}
            />
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
