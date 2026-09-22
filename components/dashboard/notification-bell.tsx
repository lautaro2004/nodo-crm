"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { BellIcon } from "@/components/ui/icons";

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
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.notifications);
    setUnread(data.unread);
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
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) await load();
  }

  async function openItem(item: NotificationItem) {
    if (!item.readAt) {
      await fetch(`/api/notifications/${item.id}/read`, { method: "POST" });
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
    }
    setOpen(false);
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Notificaciones"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notificaciones</p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs text-indigo-600 hover:underline">
                Marcar todas leídas
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-slate-400">Sin notificaciones.</p>
          ) : (
            <ul className="max-h-96 space-y-0.5 overflow-y-auto">
              {items.map((n) => {
                const content = (
                  <div className={`rounded-lg px-2 py-2 text-sm ${n.readAt ? "text-slate-500" : "bg-indigo-50/60 text-slate-900"}`}>
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
