// Marca de Nodo: tres nodos conectados — dos en grafito que confluyen en
// uno naranja (el naranja de Kodexa). El SVG
// vive también en public/logo-nodo-mark.svg y app/icon.svg (favicon).
// `dark` = sobre fondo oscuro (las piezas grafito pasan a claras).
export function LogoMark({ className = "h-8 w-8", dark = false }: { className?: string; dark?: boolean }) {
  const ink = dark ? "#f5f4f0" : "#1f2023";
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="nodo-mark-o" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fd9452" />
          <stop offset="1" stopColor="#e45c0c" />
        </linearGradient>
      </defs>
      <path d="M140 150 L256 380 L372 150" fill="none" stroke={ink} strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="140" cy="150" r="78" fill={ink} />
      <circle cx="372" cy="150" r="78" fill={ink} />
      <circle cx="256" cy="380" r="96" fill="url(#nodo-mark-o)" />
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
