"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, InlineAlert, Input, Label, Select } from "@/components/ui/primitives";
import { PlusIcon } from "@/components/ui/icons";
import { readApiError } from "@/lib/error-messages";
import { canManage, normalizeRole, PRODUCT_LABELS, ROLE_HINTS, ROLE_LABELS, type Product, type Role } from "@/lib/permissions";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  products: string[];
  createdAt: string;
}
interface Invitation {
  id: string;
  email: string;
  role: string;
  products: string[];
  expiresAt: string;
}

const ROLE_BADGE: Record<Role, "brand" | "neutral" | "success"> = { owner: "brand", admin: "success", member: "neutral" };

export function TeamManager({
  me,
  assignable,
  products,
  members,
  invitations,
}: {
  me: { userId: string; role: Role };
  assignable: Role[];
  products: Product[];
  members: Member[];
  invitations: Invitation[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ email: string; link: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(assignable.includes("member") ? "member" : assignable[0]);
  const [selected, setSelected] = useState<Product[]>(products.includes("crm") ? ["crm"] : products.slice(0, 1));

  async function call(url: string, init: RequestInit) {
    setError(null);
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    if (!res.ok) {
      setError(await readApiError(res));
      return null;
    }
    startTransition(() => router.refresh());
    return res.json().catch(() => ({}));
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const result = await call("/api/team/invitations", { method: "POST", body: JSON.stringify({ email, role, products: selected }) });
    if (result) {
      setNotice(result);
      setCopied(false);
      setEmail("");
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const toggle = (list: string[], p: string) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]);

  return (
    <div className="space-y-6">
      {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900" role="status">
          <p className="font-medium">
            Invitación creada para {notice.email}.{" "}
            {notice.emailSent ? "Le mandamos un email." : "El email no se pudo enviar (Resend no está configurado): compartile el link."}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1.5 text-xs text-slate-700 ring-1 ring-emerald-200">{notice.link}</code>
            <Button type="button" size="sm" variant="secondary" onClick={() => copy(notice.link)}>
              {copied ? "¡Copiado!" : "Copiar link"}
            </Button>
            <a
              className="text-xs font-medium text-emerald-800 underline"
              href={`https://wa.me/?text=${encodeURIComponent(`Te invité a sumarte al equipo en Nodo: ${notice.link}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Enviar por WhatsApp
            </a>
          </div>
          <p className="mt-2 text-xs text-emerald-800/80">Por seguridad, este link no se vuelve a mostrar. Si lo perdés, usá “Reenviar”.</p>
        </div>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Invitar a alguien</h2>
        <form onSubmit={invite} className="mt-4 grid gap-4 md:grid-cols-[1fr_12rem] md:items-start">
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.com" />
          </div>
          <div>
            <Label htmlFor="invite-role">Rol</Label>
            <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {assignable.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-500">{ROLE_HINTS[role]}</p>
          </div>
          <fieldset className="md:col-span-2">
            <legend className="mb-1.5 text-[13px] font-medium text-slate-700">Acceso a</legend>
            <div className="flex flex-wrap gap-4">
              {products.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={selected.includes(p)} onChange={() => setSelected(toggle(selected, p) as Product[])} />
                  {PRODUCT_LABELS[p]}
                </label>
              ))}
              {!products.includes("nexo") && <span className="text-xs text-slate-400">Nexo no está activo en este negocio.</span>}
            </div>
          </fieldset>
          <div className="md:col-span-2">
            <Button type="submit" disabled={pending || !email || selected.length === 0}>
              <PlusIcon className="h-4 w-4" />
              Enviar invitación
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Miembros ({members.length})</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {members.map((m) => {
            const r = normalizeRole(m.role);
            const editable = m.userId !== me.userId && canManage(me.role, r);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {(m.name || m.email)[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {m.name || m.email}
                    {m.userId === me.userId && <span className="ml-1 text-xs font-normal text-slate-500">(vos)</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">{m.email}</p>
                </div>

                {editable ? (
                  <Select
                    aria-label={`Rol de ${m.email}`}
                    value={r}
                    disabled={pending}
                    onChange={(e) => call(`/api/team/members/${m.id}`, { method: "PATCH", body: JSON.stringify({ role: e.target.value }) })}
                    className="w-auto min-w-36"
                  >
                    {assignable.map((x) => (
                      <option key={x} value={x}>
                        {ROLE_LABELS[x]}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge variant={ROLE_BADGE[r]}>{ROLE_LABELS[r]}</Badge>
                )}

                <div className="flex items-center gap-3">
                  {products.map((p) => (
                    <label key={p} className={`flex items-center gap-1.5 text-xs ${editable ? "text-slate-700" : "text-slate-400"}`}>
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-brand-500"
                        checked={m.products.includes(p)}
                        disabled={!editable || pending}
                        aria-label={`Acceso a ${PRODUCT_LABELS[p]} para ${m.email}`}
                        onChange={() => {
                          const next = toggle(m.products.filter((x) => products.includes(x as Product)), p);
                          if (next.length === 0) return setError("Tiene que tener acceso al menos a un producto. Para sacarlo del equipo, usá “Quitar”.");
                          call(`/api/team/members/${m.id}`, { method: "PATCH", body: JSON.stringify({ products: next }) });
                        }}
                      />
                      {p === "crm" ? "Nodo" : "Nexo"}
                    </label>
                  ))}
                </div>

                {editable && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() =>
                      window.confirm(
                        `¿Quitar a ${m.name || m.email} del equipo? Pierde el acceso a Nodo y a Nexo, y sus leads, oportunidades y tareas quedan sin responsable.`
                      ) && call(`/api/team/members/${m.id}`, { method: "DELETE" })
                    }
                  >
                    Quitar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Invitaciones pendientes ({invitations.length})</h2>
        </div>
        {invitations.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No hay invitaciones pendientes.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {invitations.map((i) => {
              const expired = new Date(i.expiresAt) < new Date();
              const editable = canManage(me.role, i.role);
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{i.email}</span>
                  <Badge variant={ROLE_BADGE[normalizeRole(i.role)]}>{ROLE_LABELS[normalizeRole(i.role)]}</Badge>
                  <span className="text-xs text-slate-500">{i.products.map((p) => (p === "crm" ? "Nodo" : "Nexo")).join(" + ")}</span>
                  <span className={`text-xs ${expired ? "text-red-600" : "text-slate-500"}`}>
                    {expired ? "Vencida" : `Vence el ${new Date(i.expiresAt).toLocaleDateString("es-AR")}`}
                  </span>
                  {editable && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={async () => {
                          const result = await call(`/api/team/invitations/${i.id}/resend`, { method: "POST" });
                          if (result) {
                            setNotice(result);
                            setCopied(false);
                          }
                        }}
                      >
                        Reenviar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => window.confirm(`¿Cancelar la invitación a ${i.email}?`) && call(`/api/team/invitations/${i.id}`, { method: "DELETE" })}
                      >
                        Cancelar
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <details className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 text-sm text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-800">Qué puede hacer cada rol</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <strong>Dueño:</strong> todo, incluida la facturación de Nexo y la gestión de administradores.
          </li>
          <li>
            <strong>Administrador:</strong> configura Nodo (estados, pipelines, campos, automatizaciones, importación) y Nexo (servicios, horarios, sitio,
            IA), invita y gestiona miembros. No ve la facturación.
          </li>
          <li>
            <strong>Miembro:</strong> trabaja el día a día: leads, oportunidades, empresas, contactos, tareas y calendario en Nodo; turnos,
            consultas y conversaciones en Nexo. No configura, no importa ni borra registros.
          </li>
          <li>El acceso a Nodo y Nexo se habilita por persona. Quitar a alguien lo saca de los dos productos.</li>
        </ul>
      </details>
    </div>
  );
}
