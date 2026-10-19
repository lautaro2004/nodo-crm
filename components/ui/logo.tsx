// Marca de Nodo: una "N" armada con piezas redondeadas — mismo lenguaje
// que el logo de Nexo (familia Kodexa), en el naranja de Kodexa. El SVG
// vive también en public/logo-nodo-mark.svg y app/icon.svg (favicon).
// `dark` = sobre fondo oscuro (la pieza grafito pasa a clara).
export function LogoMark({ className = "h-8 w-8", dark = false }: { className?: string; dark?: boolean }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="nodo-mark-o" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fd9452" />
          <stop offset="1" stopColor="#e45c0c" />
        </linearGradient>
      </defs>
      <line x1="138" y1="126" x2="374" y2="386" stroke="#fb6e1a" strokeOpacity="0.55" strokeWidth="112" strokeLinecap="round" />
      <rect x="76" y="64" width="124" height="384" rx="62" fill="url(#nodo-mark-o)" />
      <rect x="312" y="64" width="124" height="384" rx="62" fill={dark ? "#f5f4f0" : "#1f2023"} />
    </svg>
  );
}

export function Logo({ className = "", showTagline = true }: { className?: string; showTagline?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoMark className="h-8 w-8 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-bold tracking-[-0.03em] text-slate-900">Nodo</span>
        {showTagline && <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">by Kodexa</span>}
      </span>
    </div>
  );
}
