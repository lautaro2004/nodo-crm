"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { BellIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/primitives";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  resourceHref: string | null;
  readAt: string | null;
  createdAt: string;
}

// Sin polling continuo (evita otro setInterval de larga vida en un
// entorno serverless): se refresca al abrir el dropdown y al volver a
// enfocar la pestaña, que cubre el caso real de "me llegó algo mientras
// no miraba".
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  // null = todavía no se cargó nunca; "error" = falló la última carga.
  const [status, setStatus] = useState<"idle" | "loading" | "error" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setStatus((s) => (s === null || s === "error" ? "loading" : s));
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setItems(data.notifications);
      setUnread(data.unread);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
    function onFocus() {
      load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) await load();
  }

  async function openItem(item: NotificationItem) {
    setOpen(false);
    if (!item.readAt) {
      // Optimista: marcar como leída no debe demorar la navegación.
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      fetch(`/api/notifications/${item.id}/read`, { method: "POST" }).catch(() => undefined);
    }
  }

  async function markAllRead() {
    const before = { items, unread };
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    const res = await fetch("/api/notifications/read-all", { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      setItems(before.items);
      setUnread(before.unread);
      setStatus("error");
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-[background-color,color,transform] hover:bg-slate-900/[0.05] hover:text-slate-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="glass animate-pop-in absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notificaciones</p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs text-brand-700 hover:underline">
                Marcar todas leídas
              </button>
            )}
          </div>
          {status === "loading" && items.length === 0 ? (
            <div className="space-y-1.5 p-2" aria-label="Cargando notificaciones">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : status === "error" && items.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-slate-500">
              No pudimos cargar las notificaciones.{" "}
              <button type="button" onClick={() => void load()} className="font-medium text-brand-700 hover:underline">
                Reintentar
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-slate-400">Sin notificaciones.</p>
          ) : (
            <ul className="max-h-96 space-y-0.5 overflow-y-auto">
              {items.map((n) => {
                const content = (
                  <div className={`rounded-lg px-2 py-2 text-sm ${n.readAt ? "text-slate-500" : "bg-brand-50/60 text-slate-900"}`}>
                    <p className="font-medium">{n.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.resourceHref ? (
                      <Link href={n.resourceHref} onClick={() => openItem(n)} className="block">
                        {content}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => openItem(n)} className="block w-full text-left">
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
