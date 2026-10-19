"use client";

import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/ui/logo";
import { MenuIcon, XIcon } from "@/components/ui/icons";

const LINKS = [
  { href: "#producto", label: "Producto" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#nexo", label: "Con Nexo" },
  { href: "#planes", label: "Planes" },
];

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="glass-bar sticky top-0 z-50 border-b border-slate-200/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Nodo, inicio">
          <Logo showTagline={false} />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-500 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-slate-900">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900">
            Ingresar
          </Link>
          <Link
            href="/registro"
            className="inline-flex h-9 items-center rounded-xl bg-brand-500 px-4 text-sm font-medium text-slate-900 shadow-[0_1px_0_rgb(255_255_255/0.35)_inset,0_1px_2px_rgb(32_33_36/0.12)] hover:bg-brand-400"
          >
            Empezar gratis
          </Link>
        </div>
        <button type="button" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-lg p-2 text-slate-600 md:hidden">
          {open ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-200/70 px-4 pb-4 md:hidden">
          <nav className="flex flex-col py-2">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-base font-medium text-slate-800 hover:bg-slate-100">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex gap-2">
            <Link href="/login" className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-center text-sm font-medium text-slate-800">
              Ingresar
            </Link>
            <Link href="/registro" className="flex-1 rounded-xl bg-brand-500 py-2.5 text-center text-sm font-medium text-slate-900">
              Empezar gratis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
