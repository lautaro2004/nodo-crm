import type { NextConfig } from "next";

// Sin las particularidades de Nexo (baileys/pino/pdf-parse) — el CRM no las
// necesita en esta fase. Se agrega acá si en el futuro hace falta un
// paquete Node-only equivalente.
const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  // Módulos, Automatizaciones e Integraciones pasaron de Configuración a
  // secciones propias del menú. Las rutas viejas siguen funcionando
  // (favoritos, links en emails o notas, regresos de OAuth viejos).
  async redirects() {
    return [
      { source: "/dashboard/configuracion/automatizaciones/:path*", destination: "/dashboard/automatizaciones/:path*", permanent: false },
      { source: "/dashboard/configuracion/modulos/:path*", destination: "/dashboard/modulos/:path*", permanent: false },
      { source: "/dashboard/configuracion/integraciones/:path*", destination: "/dashboard/integraciones/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
