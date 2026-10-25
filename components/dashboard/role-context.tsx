"use client";

import { createContext, useContext, type ReactNode } from "react";

import { hasRole, type Role } from "@/lib/permissions";
import { OWNER_POLICY, canAdmin, canDo, type AdminPermission, type ClientAccess, type ModuleAction } from "@/lib/access";

// Rol del usuario en el negocio y sus permisos de Nodo, resueltos en el
// servidor (dashboard layout). Solo para mostrar/ocultar UI: el control
// real está en las rutas de API (lib/api-guard.ts).
const RoleContext = createContext<Role>("member");
const AccessContext = createContext<ClientAccess>({ isOwner: false, roleKey: "member", roleName: "Miembro", policy: OWNER_POLICY });

export function RoleProvider({ role, access, children }: { role: Role; access?: ClientAccess; children: ReactNode }) {
  const content = <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
  return access ? <AccessContext.Provider value={access}>{content}</AccessContext.Provider> : content;
}

export function useRole(): Role {
  return useContext(RoleContext);
}

export function useCan(minRole: Role): boolean {
  return hasRole(useContext(RoleContext), minRole);
}

export function useAccess(): ClientAccess {
  return useContext(AccessContext);
}

/** ¿Puede hacer `action` en el módulo? (solo UI). */
export function useCanDo(entityType: string, action: ModuleAction): boolean {
  return canDo(useContext(AccessContext).policy, entityType, action);
}

export function useCanAdmin(permission: AdminPermission): boolean {
  return canAdmin(useContext(AccessContext).policy, permission);
}
