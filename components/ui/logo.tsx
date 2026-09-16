export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
        N
      </span>
      <span className="text-base font-semibold tracking-tight text-slate-900">Nodo</span>
    </div>
  );
}
