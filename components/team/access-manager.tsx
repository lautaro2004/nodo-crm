"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, Input, Label, Select } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/error-messages";
import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_LABELS,
  MODULE_ACTIONS,
  MODULE_ACTION_LABELS,
  PSEUDO_MODULES,
  RECORD_SCOPES,
  RECORD_SCOPE_LABELS,
  applyOverrides,
  modulePermission,
  type AccessPolicy,
  type ModulePermission,
  type PolicyOverrides,
} from "@/lib/access";

interface RoleRow {
  key: string;
  name: string;
  description: string;
  system: boolean;
  policy: AccessPolicy;
  memberCount: number;
}
interface MemberRow {
  userId: string;
  name: string;
  email: string;
  membershipRole: string;
  roleKey: string;
  explicitRole: boolean;
  overrides: PolicyOverrides;
}
interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  leadUserId: string | null;
  memberIds: string[];
}

type Tab = "roles" | "people" | "teams";

// Equipos, roles y permisos de Nodo. Solo lo ven dueños/administradores
// del negocio; todo se valida de nuevo en el servidor (modules/access).
export function AccessManager({
  roles,
  members,
  teams,
  modules,
  currentUserId,
  isOwner,
}: {
  roles: RoleRow[];
  members: MemberRow[];
  teams: TeamRow[];
  modules: { entityType: string; label: string }[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const [tab, setTab] = useState<Tab>("roles");
  const allModules = [...modules, ...PSEUDO_MODULES.map((p) => ({ entityType: p.key, label: p.label }))];
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1.5" aria-label="Secciones">
        {(
          [
            ["roles", "Roles y permisos"],
            ["people", "Personas"],
            ["teams", "Equipos y jerarquía"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-current={tab === k ? "page" : undefined}
            onClick={() => setTab(k)}
            className={`inline-flex h-8 items-center rounded-full px-3.5 text-sm font-medium ${tab === k ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:text-slate-900"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "roles" && <RolesTab roles={roles} modules={allModules} />}
      {tab === "people" && <PeopleTab roles={roles} members={members} modules={allModules} currentUserId={currentUserId} isOwner={isOwner} />}
      {tab === "teams" && <TeamsTab teams={teams} members={members} />}
    </div>
  );
}

function useApi() {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  async function call(url: string, method: string, body?: unknown, success?: string) {
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
    if (!res) {
      setError("Sin conexión. El cambio no se guardó.");
      return false;
    }
    if (!res.ok) {
      setError(await readApiError(res));
      return false;
    }
    if (success) toast.success(success);
    startTransition(() => router.refresh());
    return true;
  }
  return { call, pending, error, setError };
}

// ── Roles ───────────────────────────────────────────────────────────────

function PolicyMatrix({ policy, modules, onChange }: { policy: AccessPolicy; modules: { entityType: string; label: string }[]; onChange: (p: AccessPolicy) => void }) {
  const rows = [{ entityType: "*", label: "Cualquier otro módulo (incluye los que se creen)" }, ...modules];
  function set(entityType: string, patch: Partial<ModulePermission>) {
    const current = policy.modules[entityType] ?? modulePermission(policy, entityType);
    let next = { ...current, ...patch };
    if (patch.view === false) next = { ...next, create: false, edit: false, delete: false, export: false };
    if (Object.entries(patch).some(([k, v]) => k !== "view" && k !== "scope" && v === true)) next.view = true;
    onChange({ ...policy, modules: { ...policy.modules, [entityType]: next } });
  }
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Módulo</th>
              {MODULE_ACTIONS.map((a) => (
                <th key={a} className="px-2 py-2 text-center">
                  {MODULE_ACTION_LABELS[a]}
                </th>
              ))}
              <th className="px-3 py-2">Ve</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const perm = policy.modules[m.entityType] ?? modulePermission(policy, m.entityType);
              const inherited = m.entityType !== "*" && !policy.modules[m.entityType];
              return (
                <tr key={m.entityType} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2">
                    <span className={m.entityType === "*" ? "font-medium text-slate-900" : "text-slate-800"}>{m.label}</span>
                    {inherited && <span className="ml-1 text-xs text-slate-400">(igual que «otro módulo»)</span>}
                  </td>
                  {MODULE_ACTIONS.map((a) => (
                    <td key={a} className="px-2 py-2 text-center">
                      <input type="checkbox" aria-label={`${MODULE_ACTION_LABELS[a]} ${m.label}`} className="h-4 w-4 accent-brand-500" checked={perm[a]} onChange={(e) => set(m.entityType, { [a]: e.target.checked })} />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <Select aria-label={`Alcance ${m.label}`} value={perm.scope} onChange={(e) => set(m.entityType, { scope: e.target.value as ModulePermission["scope"] })} className="h-8 min-w-40 text-xs">
                      {RECORD_SCOPES.map((s) => (
                        <option key={s} value={s}>
                          {RECORD_SCOPE_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Permisos administrativos</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ADMIN_PERMISSIONS.map((p) => (
            <label key={p} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-500" checked={policy.admin[p]} onChange={(e) => onChange({ ...policy, admin: { ...policy.admin, [p]: e.target.checked } })} />
              <span>
                <span className="font-medium text-slate-800">{ADMIN_PERMISSION_LABELS[p].label}</span>
                <span className="block text-xs text-slate-500">{ADMIN_PERMISSION_LABELS[p].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function RolesTab({ roles, modules }: { roles: RoleRow[]; modules: { entityType: string; label: string }[] }) {
  const { call, pending, error } = useApi();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ key: string | null; name: string; description: string; policy: AccessPolicy } | null>(null);

  function open(role: RoleRow | null) {
    if (!role) {
      const base = roles.find((r) => r.key === "member")!;
      setDraft({ key: null, name: "", description: "", policy: base.policy });
      setEditing("new");
      return;
    }
    setDraft({ key: role.key, name: role.name, description: role.description, policy: role.policy });
    setEditing(role.key);
  }

  async function save() {
    if (!draft) return;
    const body = { name: draft.name, description: draft.description, permissions: draft.policy };
    const ok = draft.key ? await call(`/api/access/roles/${draft.key}`, "PATCH", body, "Rol guardado") : await call("/api/access/roles", "POST", body, "Rol creado");
    if (ok) setEditing(null);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Cada persona tiene un rol (por defecto, el que corresponde a su rol en el equipo) y puede tener excepciones. El <strong>dueño</strong> siempre tiene todo. Los permisos se validan en el servidor:
        ocultar un botón no alcanza para hacer la acción.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-4">
        {roles.map((r) => (
          <Card key={r.key} className="p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              {r.name}
              {r.system ? <Badge>Del sistema</Badge> : <Badge variant="brand">Propio</Badge>}
            </p>
            <p className="mt-1 text-xs text-slate-500">{r.description || "Sin descripción."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => open(r)}>
                Editar permisos
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-600"
                onClick={async () => {
                  const ok = await confirm({
                    title: r.system ? `¿Restaurar “${r.name}”?` : `¿Borrar el rol “${r.name}”?`,
                    description: r.system ? "Vuelve a los permisos originales." : "Quienes lo tienen vuelven al rol por defecto de su rol de equipo.",
                    tone: "danger",
                  });
                  if (ok) await call(`/api/access/roles/${r.key}`, "DELETE", undefined, r.system ? "Rol restaurado" : "Rol borrado");
                }}
              >
                {r.system ? "Restaurar" : "Borrar"}
              </Button>
            </div>
          </Card>
        ))}
        <button type="button" onClick={() => open(null)} className="rounded-2xl border border-dashed border-slate-300 p-4 text-left text-sm text-slate-600 hover:border-slate-400 hover:text-slate-900">
          <span className="font-semibold">+ Nuevo rol</span>
          <span className="mt-1 block text-xs text-slate-500">Por ejemplo «Vendedor»: ve y edita leads, pero no los elimina.</span>
        </button>
      </div>

      {editing && draft && (
        <Card className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="role-name">Nombre</Label>
              <Input id="role-name" value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="role-desc">Descripción</Label>
              <Input id="role-desc" value={draft.description} maxLength={200} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
          </div>
          <PolicyMatrix policy={draft.policy} modules={modules} onChange={(policy) => setDraft({ ...draft, policy })} />
          <div className="flex gap-2">
            <Button type="button" onClick={save} loading={pending} disabled={!draft.name.trim()}>
              Guardar rol
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Personas ────────────────────────────────────────────────────────────

type Tri = "inherit" | "yes" | "no";

function PeopleTab({
  roles,
  members,
  modules,
  currentUserId,
  isOwner,
}: {
  roles: RoleRow[];
  members: MemberRow[];
  modules: { entityType: string; label: string }[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const { call, pending, error } = useApi();
  const [open, setOpen] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<PolicyOverrides>({});

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Card className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {members.map((m) => {
            const locked = m.membershipRole === "owner" || m.userId === currentUserId || (!isOwner && m.membershipRole === "admin");
            const role = roles.find((r) => r.key === m.roleKey);
            const exceptions = Object.keys(m.overrides.modules ?? {}).length + Object.keys(m.overrides.admin ?? {}).length;
            return (
              <li key={m.userId} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{m.name || m.email}</p>
                    <p className="truncate text-xs text-slate-500">
                      {m.email}
                      {exceptions ? ` · ${exceptions} ${exceptions === 1 ? "excepción" : "excepciones"}` : ""}
                    </p>
                  </div>
                  {m.membershipRole === "owner" ? (
                    <Badge variant="brand">Dueño · todo</Badge>
                  ) : (
                    <Select
                      aria-label={`Rol de ${m.name}`}
                      value={m.explicitRole ? m.roleKey : ""}
                      disabled={locked || pending}
                      onChange={(e) => call(`/api/access/members/${m.userId}`, "PATCH", { roleKey: e.target.value || null }, "Rol actualizado")}
                      className="w-auto min-w-48"
                    >
                      <option value="">Por defecto ({roles.find((r) => r.key === (m.membershipRole === "admin" ? "admin" : "member"))?.name})</option>
                      {roles.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  )}
                  {!locked && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setOverrides(m.overrides);
                        setOpen(open === m.userId ? null : m.userId);
                      }}
                    >
                      Excepciones
                    </Button>
                  )}
                  {m.userId === currentUserId && <span className="text-xs text-slate-400">Vos (no podés editar tus permisos)</span>}
                </div>
                {open === m.userId && role && (
                  <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-600">
                      Sobre el rol <strong>{role.name}</strong>. «—» = como dice el rol. Ejemplo: dejarle eliminar leads a un vendedor sin cambiar su rol.
                    </p>
                    <OverridesMatrix base={role.policy} overrides={overrides} modules={modules} onChange={setOverrides} />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        loading={pending}
                        onClick={async () => {
                          if (await call(`/api/access/members/${m.userId}`, "PATCH", { overrides }, "Excepciones guardadas")) setOpen(null);
                        }}
                      >
                        Guardar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setOverrides({})}>
                        Quitar todas
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function TriSelect({ value, onChange, label }: { value: Tri; onChange: (v: Tri) => void; label: string }) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as Tri)} className={`h-8 w-16 px-1 text-xs ${value === "yes" ? "text-emerald-700" : value === "no" ? "text-red-600" : ""}`}>
      <option value="inherit">—</option>
      <option value="yes">Sí</option>
      <option value="no">No</option>
    </Select>
  );
}

function OverridesMatrix({ base, overrides, modules, onChange }: { base: AccessPolicy; overrides: PolicyOverrides; modules: { entityType: string; label: string }[]; onChange: (o: PolicyOverrides) => void }) {
  const effective = applyOverrides(base, overrides);
  const triOf = (v: boolean | undefined): Tri => (v === undefined ? "inherit" : v ? "yes" : "no");
  function setModule(entityType: string, key: keyof ModulePermission, value: Tri | string) {
    const mods = { ...(overrides.modules ?? {}) };
    const cur = { ...(mods[entityType] ?? {}) } as Record<string, unknown>;
    if (value === "inherit" || value === "") delete cur[key];
    else cur[key] = key === "scope" ? value : value === "yes";
    if (Object.keys(cur).length) mods[entityType] = cur as Partial<ModulePermission>;
    else delete mods[entityType];
    onChange({ ...overrides, modules: mods });
  }
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 pr-2">Módulo</th>
              {MODULE_ACTIONS.map((a) => (
                <th key={a} className="px-1 py-1 text-center">
                  {MODULE_ACTION_LABELS[a]}
                </th>
              ))}
              <th className="px-1 py-1">Ve</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => {
              const o = overrides.modules?.[m.entityType] ?? {};
              const eff = modulePermission(effective, m.entityType);
              return (
                <tr key={m.entityType}>
                  <td className="py-1 pr-2 text-slate-800">{m.label}</td>
                  {MODULE_ACTIONS.map((a) => (
                    <td key={a} className="px-1 py-1 text-center" title={`Efectivo: ${eff[a] ? "Sí" : "No"}`}>
                      <TriSelect label={`${MODULE_ACTION_LABELS[a]} ${m.label}`} value={triOf(o[a])} onChange={(v) => setModule(m.entityType, a, v)} />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <Select aria-label={`Alcance ${m.label}`} value={o.scope ?? ""} onChange={(e) => setModule(m.entityType, "scope", e.target.value)} className="h-8 text-xs">
                      <option value="">— ({RECORD_SCOPE_LABELS[modulePermission(base, m.entityType).scope]})</option>
                      {RECORD_SCOPES.map((s) => (
                        <option key={s} value={s}>
                          {RECORD_SCOPE_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3">
        {ADMIN_PERMISSIONS.map((p) => (
          <label key={p} className="flex items-center gap-1.5 text-xs text-slate-700">
            {ADMIN_PERMISSION_LABELS[p].label}
            <TriSelect
              label={ADMIN_PERMISSION_LABELS[p].label}
              value={triOf(overrides.admin?.[p])}
              onChange={(v) => {
                const admin = { ...(overrides.admin ?? {}) };
                if (v === "inherit") delete admin[p];
                else admin[p] = v === "yes";
                onChange({ ...overrides, admin });
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Equipos ─────────────────────────────────────────────────────────────

function TeamsTab({ teams, members }: { teams: TeamRow[]; members: MemberRow[] }) {
  const { call, pending, error } = useApi();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<TeamRow | "new" | null>(null);
  const name = (u: string | null) => (u ? (members.find((m) => m.userId === u)?.name ?? "Ex miembro") : null);
  const children = (id: string | null) => teams.filter((t) => t.parentId === id);

  function Tree({ parentId, depth }: { parentId: string | null; depth: number }) {
    return (
      <ul className={depth ? "ml-5 border-l border-slate-200 pl-3" : ""}>
        {children(parentId).map((t) => (
          <li key={t.id} className="py-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-900">{t.name}</span>
              {t.leadUserId && <Badge variant="brand">Responsable: {name(t.leadUserId)}</Badge>}
              <span className="text-xs text-slate-500">
                {t.memberIds.length} {t.memberIds.length === 1 ? "miembro" : "miembros"}
                {t.memberIds.length ? `: ${t.memberIds.map((u) => name(u)).join(", ")}` : ""}
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(t)}>
                Editar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-600"
                onClick={async () => {
                  if (await confirm({ title: `¿Borrar el equipo “${t.name}”?`, description: "Sus sub-equipos quedan sin equipo padre. Nadie pierde su cuenta.", tone: "danger" }))
                    await call(`/api/access/teams/${t.id}`, "DELETE", undefined, "Equipo borrado");
                }}
              >
                Borrar
              </Button>
            </div>
            {children(t.id).length > 0 && <Tree parentId={t.id} depth={depth + 1} />}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Los equipos definen qué ve cada persona cuando su alcance es «Los de su equipo»: los registros de sus compañeros de equipo y, si es responsable, también los de todos los sub-equipos.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Card className="p-4">
        {teams.length === 0 ? <p className="text-sm text-slate-500">Todavía no hay equipos. Ejemplo: Dirección → Ventas → (Vendedor 1, Vendedor 2).</p> : <Tree parentId={null} depth={0} />}
        <Button type="button" size="sm" className="mt-3" onClick={() => setEditing("new")}>
          Nuevo equipo
        </Button>
      </Card>
      {editing && (
        <TeamForm
          key={editing === "new" ? "new" : editing.id}
          team={editing === "new" ? null : editing}
          teams={teams}
          members={members}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={async (body) => {
            const ok = editing === "new" ? await call("/api/access/teams", "POST", body, "Equipo creado") : await call(`/api/access/teams/${editing.id}`, "PATCH", body, "Equipo guardado");
            if (ok) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TeamForm({
  team,
  teams,
  members,
  pending,
  onCancel,
  onSave,
}: {
  team: TeamRow | null;
  teams: TeamRow[];
  members: MemberRow[];
  pending: boolean;
  onCancel: () => void;
  onSave: (body: { name: string; description: string | null; parentId: string | null; leadUserId: string | null; memberIds: string[] }) => void;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [parentId, setParentId] = useState(team?.parentId ?? "");
  const [leadUserId, setLeadUserId] = useState(team?.leadUserId ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(team?.memberIds ?? []);
  // Un equipo no puede depender de sí mismo ni de un sub-equipo suyo (el servidor también lo impide).
  const descendants = new Set<string>();
  if (team) {
    const stack = [team.id];
    while (stack.length) {
      const id = stack.pop()!;
      for (const t of teams) {
        if (t.parentId === id && !descendants.has(t.id)) {
          descendants.add(t.id);
          stack.push(t.id);
        }
      }
    }
  }
  const parents = teams.filter((t) => t.id !== team?.id && !descendants.has(t.id));
  return (
    <Card className="space-y-3 p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="team-name">Nombre</Label>
          <Input id="team-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ej: Equipo de Ventas" />
        </div>
        <div>
          <Label htmlFor="team-parent">Depende de</Label>
          <Select id="team-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Ninguno (nivel superior)</option>
            {parents.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="team-lead">Responsable / supervisor</Label>
          <Select id="team-lead" value={leadUserId} onChange={(e) => setLeadUserId(e.target.value)}>
            <option value="">Sin responsable</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name || m.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="team-desc">Descripción</Label>
          <Input id="team-desc" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Miembros</p>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => {
            const on = memberIds.includes(m.userId);
            return (
              <button
                key={m.userId}
                type="button"
                aria-pressed={on}
                onClick={() => setMemberIds(on ? memberIds.filter((u) => u !== m.userId) : [...memberIds, m.userId])}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${on ? "bg-brand-50 text-brand-800 ring-brand-300" : "bg-white text-slate-600 ring-slate-200"}`}
              >
                {m.name || m.email}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" loading={pending} disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), description: description.trim() || null, parentId: parentId || null, leadUserId: leadUserId || null, memberIds })}>
          Guardar equipo
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
