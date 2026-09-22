// Compartido entre TaskReminderField (cliente) y el server de la página de
// edición (para derivar la opción inicial a partir de un remindAt guardado).
export const REMINDER_OFFSETS = [
  { key: "none", label: "Sin recordatorio", minutes: null },
  { key: "5", label: "5 minutos antes", minutes: 5 },
  { key: "15", label: "15 minutos antes", minutes: 15 },
  { key: "30", label: "30 minutos antes", minutes: 30 },
  { key: "60", label: "1 hora antes", minutes: 60 },
  { key: "1440", label: "1 día antes", minutes: 1440 },
  { key: "custom", label: "Personalizado", minutes: null },
] as const;
export type ReminderOffsetKey = (typeof REMINDER_OFFSETS)[number]["key"];

// dueAt/remindAt en formato "YYYY-MM-DDTHH:mm" (valor crudo de un input
// datetime-local, siempre hora local del navegador — no hace falta más
// precisión de timezone que eso para esta función).
export function computeRemindAt(dueAt: string, offsetMinutes: number): string | null {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  d.setMinutes(d.getMinutes() - offsetMinutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Inversa aproximada: a partir de un remindAt guardado + el dueAt actual,
// adivina qué opción de la lista lo generó (para preseleccionar el <select>
// al editar). Si no calza con ninguna, se trata como "custom".
export function guessOffsetKey(dueAt: string, remindAt: string): ReminderOffsetKey {
  if (!dueAt || !remindAt) return "custom";
  const due = new Date(dueAt).getTime();
  const remind = new Date(remindAt).getTime();
  if (Number.isNaN(due) || Number.isNaN(remind)) return "custom";
  const diffMinutes = Math.round((due - remind) / 60000);
  const match = REMINDER_OFFSETS.find((o) => o.minutes === diffMinutes);
  return match ? match.key : "custom";
}
