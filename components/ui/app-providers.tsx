"use client";

import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { AutomationPromptProvider } from "@/components/automations/automation-prompt";

// Proveedores de feedback compartidos (toasts y confirmaciones). Solo
// estado de UI en memoria: nada se persiste en el navegador.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AutomationPromptProvider>{children}</AutomationPromptProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
