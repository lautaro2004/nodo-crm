import type { NextConfig } from "next";

// Sin las particularidades de Nexo (baileys/pino/pdf-parse) — el CRM no las
// necesita en esta fase. Se agrega acá si en el futuro hace falta un
// paquete Node-only equivalente.
const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
