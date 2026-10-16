// Marca de Nodo: un "nodo" naranja conectado a otros dos sobre grafito —
// mismo par de colores que Kodexa (ink + naranja de marca).
export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-slate-900 shadow-sm ring-1 ring-black/5">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
          <path d="M7 7.5 12 12l5-4.5M12 12v5" stroke="#d5d4cf" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <circle cx="7" cy="7.5" r="2" fill="#d5d4cf" />
          <circle cx="17" cy="7.5" r="2" fill="#d5d4cf" />
          <circle cx="12" cy="17.5" r="2" fill="#d5d4cf" />
          <circle cx="12" cy="12" r="3" fill="#fb6e1a" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-slate-900">Nodo</span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">by Kodexa</span>
      </span>
    </div>
  );
}
