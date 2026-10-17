"use client";

import { createContext, useContext, type ReactNode } from "react";

import { hasRole, type Role } from "@/lib/permissions";

// Rol del usuario en el negocio, resuelto en el servidor (dashboard layout).
// Solo para mostrar/ocultar UI: el control real está en las rutas de API
// (requireWorkspace({ minRole })).
const RoleContext = createContext<Role>("member");

export function RoleProvider({ role, children }: { role: Role; children: ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): Role {
  return useContext(RoleContext);
}

export function useCan(minRole: Role): boolean {
  return hasRole(useContext(RoleContext), minRole);
}
