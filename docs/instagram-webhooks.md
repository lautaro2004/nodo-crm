# Instagram Messaging API — webhook (etapa 1)

App de Meta: **Kodexa Connect**. Estado: el endpoint verifica la suscripción y la firma, y registra un resumen de cada evento. **No guarda mensajes ni crea leads todavía**, y no toca la base de datos.

## Endpoint
`https://nodo.kodexa.ar/api/webhooks/instagram` (`app/api/webhooks/instagram/route.ts`). Es público: el `middleware` solo protege `/dashboard`.

- **GET (verificación):**
  - exige `hub.mode=subscribe`;
  - compara `hub.verify_token` con `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` en tiempo constante;
  - si coincide, responde `hub.challenge` en texto plano (200); si no, 403.
- **POST (eventos):**
  - lee el cuerpo original (bytes), con un tope de 1 MB;
  - valida `X-Hub-Signature-256` (`sha256=` + HMAC-SHA256 del cuerpo) contra `INSTAGRAM_APP_SECRET` y, si está, `META_APP_SECRET`;
  - recién después parsea el JSON.
  - Respuestas:
    - firma inválida o ausente → 401;
    - cuerpo no JSON → 400;
    - secretos sin configurar → 500;
    - OK → 200 `EVENT_RECEIVED`.

## Qué se registra
Solo una línea por evento, con tipos y cantidades:

```
[webhook/instagram] evento recibido: object=instagram entries=1 message_echo=1 test=true
```

Nunca se registran textos, IDs de usuarios, adjuntos, tokens ni secretos (cubierto por tests).

En desarrollo (`next dev`), Next imprime la URL de cada request, incluido el `hub.verify_token` del GET de verificación. En producción no se registran URLs desde la app.

## Variables
| Variable | Dónde se obtiene |
| --- | --- |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | La inventás vos (texto largo al azar) y la cargás igual en Meta. |
| `INSTAGRAM_APP_SECRET` | Meta → Kodexa Connect → Instagram → Configuración de la API con inicio de sesión de Instagram → "Instagram app secret". |
| `META_APP_SECRET` (opcional) | Meta → Kodexa Connect → Configuración de la app → Básica → "App secret". |

## Próximas etapas (no implementadas)
- Dedupe de reintentos (Meta reintenta hasta 36 h).
- Asociar la cuenta de Instagram a un negocio.
- Guardar las conversaciones y crear leads.
