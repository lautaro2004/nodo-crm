# Kodexa CRM

Proyecto Next.js independiente (no un monorepo con Nexo), compartiendo identidad (`public.User`/`Session`/`Account`/`Verification`/`Business`/`Membership`) y la misma base PostgreSQL/Supabase que Nexo, separado por schema (`crm`).

Documentación de arquitectura de esta fase (bootstrap técnico): [`../nexo/docs/architecture/crm-fase2-bootstrap.md`](../nexo/docs/architecture/crm-fase2-bootstrap.md).
Diseño previo (Fase 1, sin código): [`../nexo/docs/architecture/crm-fase1-diseno.md`](../nexo/docs/architecture/crm-fase1-diseno.md).

## Setup

```bash
npm install --legacy-peer-deps   # ver crm-fase2-bootstrap.md, sección "Problemas encontrados"
cp .env.example .env.local       # completar con los mismos DATABASE_URL/DIRECT_URL/BETTER_AUTH_SECRET que nexo/.env.local
npm run dev                      # http://localhost:3001
```

## Scripts

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint`
- `npm test` — suite mockeada (nunca toca la base real, no hay staging separado)
