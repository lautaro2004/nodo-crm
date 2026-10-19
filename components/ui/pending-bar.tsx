// Barra fina indeterminada para operaciones en segundo plano que NO
// bloquean la pantalla (aplicar filtros, buscar, ordenar). Se muestra con
// un pequeño retraso para no parpadear cuando la respuesta es inmediata.
// El contenedor tiene que ser `relative`; la barra se apoya en su borde
// inferior y no ocupa lugar (sin saltos de layout).
export function PendingBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      role="progressbar"
      aria-label="Actualizando resultados"
      className="pointer-events-none absolute inset-x-0 -bottom-2 h-0.5 overflow-hidden rounded-full opacity-0 [animation:nodo-fade-in_200ms_var(--ease-out)_250ms_forwards]"
    >
      <div className="animate-progress h-full w-2/5 rounded-full bg-brand-500/70" />
    </div>
  );
}
