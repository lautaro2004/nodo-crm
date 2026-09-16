import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Misma tipografía que Nexo (Geist) — consistencia de marca entre los
// productos de Kodexa, sin necesidad de compartir código entre repos.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Nodo — CRM de Kodexa",
    template: "%s — Nodo",
  },
  description: "El CRM de Kodexa: empresas, contactos, leads y oportunidades en un solo lugar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
