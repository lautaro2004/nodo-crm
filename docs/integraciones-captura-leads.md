# Integraciones de captura de leads

Nodo recibe leads automáticamente desde **Instagram** (mensajes directos) y
**Google Sheets** (filas nuevas). Todo pasa por una capa común
(`modules/integrations/`) que reutiliza el flujo existente de creación de leads.

## Modelo

| Tabla (`crm`) | Para qué |
|---|---|
| `LeadIntegration` | Una conexión de un negocio con una fuente: tipo, estado, configuración/mapeo, secreto **cifrado**, cuenta externa, última actividad y último error. `(type, externalAccountId)` es único: una cuenta de Instagram solo puede estar vinculada a un negocio. |
| `IngestionEvent` | Cada fila o mensaje recibido. `(integrationId, externalId)` es único: **un reintento nunca se procesa dos veces**. Guarda estado (`received/processed/skipped/failed`), resultado, lead asociado, error e intentos. Solo los datos mapeados necesarios para reintentar. |

Migración: `prisma/migrations/20261019150000_lead_integrations` (aditiva, solo
schema `crm`, idempotente).

## Reglas comunes (`modules/integrations/ingest.ts`)

1. Se registra el evento (idempotencia por ID externo).
2. Se busca un lead del **mismo negocio**:
   - por origen + referencia (`Lead.source` + `Lead.sourceRef`, único por negocio);
   - si no, por **email** (sin distinguir mayúsculas) o **teléfono** (últimos 10 dígitos). **Nunca por nombre.**
3. Si existe: se registra una actividad y se **completan solo los datos vacíos** (no se pisa nada cargado por el equipo).
4. Si no hay lead pero sí un **contacto** con ese email/teléfono: se registra la actividad en el contacto (no se crea lead).
5. Si no existe nada: se crea el lead con `createLead` (validaciones, "Lead creado", asignación automática).
6. El evento queda `processed` recién al final; si algo falla queda `failed` con el motivo y se puede reintentar desde Nodo.

El negocio siempre sale de la integración resuelta en el servidor, nunca del payload.

## Google Sheets (Apps Script)

- Se eligió **Apps Script** (opción A) para el MVP: la planilla puede ser privada, el cliente no comparte credenciales con Nodo y no hace falta verificar una app OAuth de Google.
- Endpoint por integración: `POST /api/integrations/sheets/<id>/ingest`.
- Autenticación: `X-Nodo-Timestamp` + `X-Nodo-Signature = HMAC-SHA256(secreto, "<timestamp>.<cuerpo>")`. Ventana de 5 minutos (anti-replay). El secreto se muestra **una sola vez**, se guarda cifrado y se puede rotar.
- Límites: 256 KB por request, 50 filas por request, 300 eventos por minuto por integración.
- Cada fila lleva un `rowId` estable (UUID) que el script guarda en la columna **"Nodo ID"**; el resultado queda en **"Nodo estado"**.
- **Activadores:** `onChange` (instalable) + un activador por tiempo cada 5 minutos como respaldo. Limitación conocida: `onEdit`/`onChange` no se disparan cuando otro script o una API escribe en la hoja; por eso, si el formulario ya usa Apps Script, hay que llamar a `nodoCRM_enviarFila(hoja, fila)` justo después de escribir la fila (o esperar la corrida de 5 minutos).
- **Convivencia con otros scripts:** el código se pega en un archivo nuevo del proyecto de Apps Script (no reemplaza el existente). Todo vive dentro del objeto `NodoCRM`; las únicas funciones globales llevan el prefijo `nodoCRM_` (`nodoCRM_probarConexion`, `nodoCRM_instalarActivadores`, `nodoCRM_sincronizar`, `nodoCRM_reintentarErrores`, `nodoCRM_enviarFila`, `nodoCRM_alCambiar`), el secreto va en la propiedad `NODO_CRM_SECRET` y el instalador solo toca los activadores de Nodo.
- Las filas con error no se reenvían solas: se corrigen y se borra "Nodo estado", o se ejecuta `nodoCRM_reintentarErrores()`.

## Instagram (API con Instagram Login)

- OAuth oficial (Business Login), iniciado por un owner/admin: `POST /api/integrations/instagram/connect` → `https://www.instagram.com/oauth/authorize` → `GET /api/integrations/instagram/callback`.
- Permisos mínimos: `instagram_business_basic`, `instagram_business_manage_messages`.
- `state` firmado (HMAC con `BETTER_AUTH_SECRET`, 10 min) + nonce en cookie httpOnly; el callback además exige que el usuario y el negocio de la sesión sean los mismos que iniciaron la conexión.
- El código se canjea en el servidor → token corto → **token largo (60 días)**, guardado cifrado. Se renueva con `POST /api/cron/refresh-integrations` (CRON_SECRET), una vez por día.
- Al conectar se activa la suscripción de webhooks de la cuenta (`POST /<IG_ID>/subscribed_apps?subscribed_fields=messages`). Si Meta no la acepta, la integración queda **con errores** (no se finge éxito).
- Webhook: `entry[].id` identifica la cuenta → negocio. Criterio:
  - primer mensaje de una persona desconocida → lead (`source = instagram`, `sourceRef = IGSID`), configurable;
  - mensajes siguientes → actividad en el mismo lead;
  - mensajes del propio negocio (echo) → nunca crean leads; si la persona ya es lead, quedan en el historial (configurable);
  - duplicados de Meta → se ignoran por `message.mid`.
- Se guarda solo: ID de la persona, nombre/usuario si la API lo da, texto del mensaje, fecha y origen. Los logs solo tienen conteos.
- Preparado para más adelante: reglas por palabras clave / clasificación con IA (punto de extensión en `runMessage`).

## Variables de entorno

| Variable | Uso |
|---|---|
| `INTEGRATIONS_ENCRYPTION_KEY` | Cifrado de tokens/secretos (32 bytes, `openssl rand -hex 32`). |
| `INSTAGRAM_APP_ID` | Instagram app ID de Kodexa Connect. |
| `INSTAGRAM_APP_SECRET` | Ya existente: firma de webhooks y canje del código OAuth. |
| `INSTAGRAM_REDIRECT_URI` | Opcional; por defecto `BETTER_AUTH_URL` + `/api/integrations/instagram/callback`. |
| `INSTAGRAM_GRAPH_VERSION` | Opcional (por defecto `v26.0`). |
| `CRON_SECRET` | Ya existente; para la renovación de tokens. |
