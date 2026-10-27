# Facturación de Nodo

Nodo **no cobra**. La facturación (planes, precios, Mercado Pago, webhooks,
conciliación, bonificaciones y superadmin) vive en **Nexo**. Nodo solo:

1. **Lee** `nexo.Subscription` / `nexo.Plan` (modelos espejo de solo lectura en `prisma/schema.prisma`).
2. **Calcula el acceso** con `lib/billing-access.ts` (copia de la de Nexo, con los mismos tests).
3. **Bloquea** si corresponde (`lib/workspace.ts` → estado `billing_blocked`).
4. **Pide a Nexo** que cobre (`/api/internal/nodo/*`), nunca habla con Mercado Pago para cobrar.

## Reglas de acceso

| Situación | Nodo |
|---|---|
| Suscripción activa o prueba vigente con plan que incluye Nodo | Acceso normal |
| Pago atrasado, dentro de 7 días desde `pastDueSince` | Acceso normal + aviso con la fecha límite |
| Pago atrasado, pasados los 7 días | Bloqueado: pantalla de planes/regularización |
| Cancelada | Acceso hasta el fin del período pago; después, bloqueado |
| Sin suscripción, plan sin Nodo, prueba o suscripción vencida | Bloqueado |

Nodo no tiene plan gratuito. Bloquear **nunca borra ni modifica datos** (registros,
módulos, campos, relaciones, automatizaciones, informes, configuración): al
regularizar el pago el acceso vuelve solo. El bloqueo se aplica en un único
punto (`resolveWorkspaceContext`): las páginas no se renderizan y la API
responde `402 { error: "billing_blocked" }`.

## Activación (decisión explícita)

`NODO_BILLING_ENFORCEMENT`:

- `off` (default): nadie se bloquea. Solo se calcula el estado.
- `report`: igual que off, pero owner/admin ven un aviso de qué pasaría.
- `on`: el bloqueo rige.

**Antes de pasar a `on`** (hoy ningún negocio tiene plan con Nodo y todos
quedarían bloqueados):

1. Aplicar las migraciones de Nexo `20261026120000`, `20261026140000`, `20261026160000` y `20261026200000`.
2. Cargar los planes de Nodo y el pack desde el superadmin de Nexo.
3. Correr el reporte de impacto (abajo) en modo `report`.
4. Darle plan o bonificación con Nodo a cada negocio que ya lo usa.
   - Atención: un negocio tiene UNA suscripción. Una bonificación con un plan de
     solo Nodo **reemplaza** su plan de Nexo mientras dure. Para quien ya paga
     Nexo y usa Nodo hace falta un plan **pack**; el cambio de plan automático
     todavía no está implementado (ver "Pendiente").
5. Recién entonces `NODO_BILLING_ENFORCEMENT=on`.

## Reporte de impacto (SQL de solo lectura, Supabase)

```sql
select b.name as negocio,
       (select count(*) from public."Membership" m where m."businessId" = b.id and 'crm' = any (m.products)) as usuarios_nodo,
       p.name as plan, s.status, s."currentPeriodEnd", s."pastDueSince",
       case
         when s.id is null then 'BLOQUEADO: sin suscripción'
         when not ('crm' = any (p.products)) then 'BLOQUEADO: el plan no incluye Nodo'
         when s.status = 'active' then 'OK'
         when s.status = 'trialing' and (s."currentPeriodEnd" is null or s."currentPeriodEnd" > now()) then 'OK (prueba)'
         when s.status = 'trialing' then 'BLOQUEADO: prueba vencida'
         when s.status = 'past_due' and now() < coalesce(s."pastDueSince", s."currentPeriodEnd", now()) + interval '7 days' then 'GRACIA (7 días)'
         when s.status = 'past_due' then 'BLOQUEADO: gracia vencida'
         when s.status = 'canceled' and s."currentPeriodEnd" > now() then 'OK hasta fin de período'
         else 'BLOQUEADO'
       end as con_cobro_activo,
       case when p."crmMaxUsers" is not null
              and (select count(*) from public."Membership" m where m."businessId" = b.id and 'crm' = any (m.products)) > p."crmMaxUsers" + coalesce(s."extraUsers", 0)
            then 'SUPERA EL LÍMITE (no se borra a nadie; se frenan nuevas altas)' end as usuarios
from crm."Workspace" w
join public."Business" b on b.id = w."businessId"
left join nexo."Subscription" s on s."businessId" = b.id
left join nexo."Plan" p on p.id = s."planId"
order by 4 desc, 1;
```

(La regla exacta está en el código; el SQL no incluye el atraso inferido por
webhooks perdidos.)

## Límite de usuarios

`crmMaxUsers` (incluidos en el plan) + `extraUsers` (contratados). Cuentan los
miembros con acceso a Nodo **más las invitaciones pendientes** (reservan lugar);
una persona con Nexo y Nodo cuenta una vez. Se valida en el servidor al invitar,
al sumar Nodo a un miembro y al aceptar una invitación. Nunca se elimina ni
desactiva a nadie si baja el límite: solo se frenan las altas nuevas. Rige solo
con `NODO_BILLING_ENFORCEMENT=on`.

## Contratar desde Nodo

Solo el dueño, desde la pantalla de planes. Flujo: el navegador genera el token
de tarjeta con Mercado Pago (la tarjeta nunca pasa por nuestros servidores) →
`POST /api/billing/checkout` (Nodo; `userId` y email salen de la sesión) →
`POST {NEXO_URL}/api/internal/nodo/checkout` con `Authorization: Bearer
NODO_BILLING_SECRET` → Nexo resuelve el negocio del usuario (debe ser el
dueño), valida el plan y reutiliza `createSubscriptionCheckout`. Precio, monto
y `businessId` **nunca** se aceptan del cliente.

Planes en USD: se cobra en pesos al dólar oficial (BNA venta) del día y se
reajusta antes de cada renovación (cron `reprice-fx` de Nexo).

## Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `NODO_BILLING_ENFORCEMENT` | Nodo | `off` / `report` / `on` |
| `NEXO_URL` | Nodo | URL base de Nexo |
| `NODO_BILLING_SECRET` | Nodo y Nexo | Secreto compartido (≥ 24 caracteres), mismo valor |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Nodo | Public Key de Mercado Pago (la misma de Nexo) |

## Pendiente

- Probar el checkout desde el dominio de Nodo en el sandbox de Mercado Pago
  (el token de tarjeta se genera con la Public Key de la misma cuenta; verificar
  que acepte el dominio de Nodo antes de usar tarjetas reales).
- Pantalla de suscripción para el dueño con acceso (ver plan, cambiar usuarios extra, cancelar).
- Cambio de plan (Nexo ↔ Nodo ↔ pack) sin cancelar y recrear; hoy es manual desde el superadmin de Nexo.
- Bonificación masiva para los negocios existentes.
