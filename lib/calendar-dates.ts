// El calendario opera en una zona horaria fija de aplicación (Argentina,
// UTC-3 sin horario de verano) para que el mismo evento caiga en el mismo
// día tanto en el server (UTC en producción) como en el browser. Cuando
// exista timezone por Business, sólo cambia esta constante/offset.
export const APP_TZ = "America/Argentina/Buenos_Aires";
const APP_OFFSET = "-03:00";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("es-AR", { timeZone: APP_TZ, hour: "2-digit", minute: "2-digit", hour12: false });

/** "YYYY-MM-DD" del instante en la zona de la app. */
export function dayKey(d: Date): string {
  return dayFmt.format(d);
}

/** "HH:mm" del instante en la zona de la app. */
export function timeLabel(d: Date): string {
  return timeFmt.format(d);
}

/** Instante para una fecha "YYYY-MM-DD" + hora "HH:mm" en la zona de la app. */
export function toInstant(date: string, time: string): Date {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}${APP_OFFSET}`);
}

export function startOfDayInstant(key: string): Date {
  return toInstant(key, "00:00");
}

export function addDaysKey(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = lunes … 6 = domingo. */
export function weekdayIndex(key: string): number {
  return (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function startOfWeekKey(key: string): string {
  return addDaysKey(key, -weekdayIndex(key));
}

export type CalendarView = "month" | "week" | "day";

export function isDayKey(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
}

/** Días (claves) que la vista debe mostrar. Mes = grilla completa lunes-domingo. */
export function visibleDays(view: CalendarView, anchor: string): string[] {
  if (view === "day") return [anchor];
  if (view === "week") {
    const s = startOfWeekKey(anchor);
    return Array.from({ length: 7 }, (_, i) => addDaysKey(s, i));
  }
  const first = `${anchor.slice(0, 7)}-01`;
  const start = startOfWeekKey(first);
  const next = new Date(`${first}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = addDaysKey(next.toISOString().slice(0, 10), -1);
  const end = addDaysKey(startOfWeekKey(lastDay), 6);
  const days: string[] = [];
  for (let k = start; k <= end; k = addDaysKey(k, 1)) days.push(k);
  return days;
}

export function shiftAnchor(view: CalendarView, anchor: string, dir: -1 | 1): string {
  if (view === "day") return addDaysKey(anchor, dir);
  if (view === "week") return addDaysKey(anchor, 7 * dir);
  const d = new Date(`${anchor.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + dir);
  return d.toISOString().slice(0, 10);
}
