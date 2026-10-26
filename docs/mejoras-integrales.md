# Mejoras integrales de Nodo — automatizaciones, relaciones, campos, vistas, informes y permisos

Este documento resume qué se implementó, cómo funciona y qué quedó pendiente.

## Migración

`prisma/migrations/20261025120000_access_automations_reports/migration.sql`

- Toca solo el schema `crm` y es 100% aditiva: no modifica ni borra datos.
- Es idempotente (`IF NOT EXISTS` / `duplicate_object`), así que también se puede pegar en el SQL Editor de Supabase.
- Se validó en un Postgres 16 local con el schema actual: se aplicó dos veces sin errores y `prisma migrate diff` no muestra diferencias contra `schema.prisma`.

| Cambio | Para qué |
|---|---|
| `CustomFieldDefinition`: `description`, `defaultValue`, `validation` (JSON), `exclusive`, `inverseLabel` | Campos editables y relaciones con cardinalidad |
| `RecordLink.exclusiveTo` + unique `(definitionId, exclusiveTo)` | La base garantiza las relaciones uno a uno y uno a muchos |
| `AutomationRule.module`, `AutomationRun.trigger/details/depth` | Motor genérico e historial por acción |
| `UserPreference` | Última vista por usuario y módulo, y panel de Informes por defecto |
| `ReportDashboard` | Paneles de Informes guardados |
| `Team`, `TeamMember`, `AccessRole`, `MemberAccess`, `InvitationAccess` | Equipos, jerarquía, roles, excepciones y rol al invitar |

## 1. Automatizaciones para todos los módulos

- **Motor:**
  - Está en `modules/automations/workflow.ts`. Se enchufa en los servicios de dominio con `trackChange` (leads, contactos, empresas, oportunidades, tareas y registros de módulos personalizados).
  - Por eso aplica igual desde la UI, el Kanban, la API, la importación y las integraciones.
- **Disparadores:** alta, modificación, alta o modificación, baja, y **antes de guardar**. Opcionalmente, "solo si cambia el campo X".
- **Condiciones:**
  - Sobre cualquier campo, estándar o personalizado.
  - Se combinan con Y/O, con un nivel de subgrupos.
  - Hay operadores por tipo: igual, contiene, mayor que, antes de, en los últimos N días, vacío, "cambió", "cambió a" y "cambió desde".
  - Se validan contra el tipo real del campo al guardar.
- **Acciones:**
  - exigir campos (antes de guardar)
  - impedir el cambio
  - actualizar un campo (valor fijo o copiado de otro campo)
  - asignar responsable (fijo o rotativo)
  - crear tarea
  - notificar
  - agregar nota
  - actualizar registros relacionados, por FK estándar o por campo relación, en cualquier dirección
- **Antes de guardar:**
  - Si falta un dato, la API responde `422 automation_required` con los campos faltantes, y no se guarda nada.
  - `components/automations/automation-prompt.tsx` intercepta esa respuesta en cualquier pantalla, pide los datos en un cuadro y reintenta el mismo request.
  - Así funciona igual para "lead → Rechazado pide motivo" que para "colaboración → Rechazada exige motivo".
- **Garantías:**
  - Una regla corre una sola vez por evento: `(ruleId, dedupeKey)` es único.
  - Las cadenas tienen como máximo 3 niveles y una regla no se repite dentro de la misma cadena (`AsyncLocalStorage`, ver `modules/automations/context.ts`).
  - Los errores quedan registrados por acción y nunca rompen la operación que disparó la regla.
- **UI:** en Configuración → Automatizaciones:
  - el constructor visual;
  - activar, pausar, editar y borrar reglas;
  - estadísticas de 30 días por regla;
  - historial filtrable por regla y resultado, con detalle por acción.
- Las reglas clásicas (asignación de leads, lead sin atención, cambio de estado) siguen funcionando igual.

## 2. Relaciones entre módulos

- **Plantilla "Colaboraciones":**
  - Tiene relación con Contacto y con Empresa (muchos a uno).
  - Campos: Máquina, Fecha de ingreso, Estado (con "Pendiente" como predeterminado), Motivo de rechazo, Observaciones y Documentación (link).
  - Los contactos muestran la sección **Colaboraciones** con links a cada una.
- **Campos relación en todos los módulos**, también en los estándar:
  - Se pueden crear desde Configuración → Campos personalizados.
  - Se editan en la ficha con un buscador de registros reales.
- **Cardinalidad:** muchos a uno, uno a uno, uno a muchos o muchos a muchos.
  - La exclusividad la garantiza la base de datos.
  - Pasar a "a uno" o a "exclusiva" se rechaza si los datos actuales lo impiden, para no perder información.
- **Permisos:** la vista inversa y el buscador solo muestran módulos y registros que la persona puede ver.

## 3. Campos personalizados editables

- **Mismo editor** para módulos estándar y personalizados (`FieldDefinitionEditor`):
  - nombre y descripción;
  - opciones: agregar, renombrar (migra los valores cargados), quitar y reordenar;
  - valor predeterminado;
  - obligatorio;
  - validaciones por tipo: largo de texto, mínimo y máximo numérico, rango de fechas.
- **Quitar una opción en uso:**
  - El servidor responde 409 con cuántos registros la usan.
  - La UI pide elegir entre conservar el valor histórico, vaciarlo o reemplazarlo por otra opción.
  - Nunca se borran datos en silencio.
- **Obligatorios:**
  - Se exigen al editar.
  - También al crear desde los formularios: las altas de lead, contacto, empresa, oportunidad y tarea ahora incluyen los campos personalizados.
- Ahora las **tareas** también tienen campos personalizados.

## 4. Vistas recordadas

- **Qué se guarda:** cada lista (leads, oportunidades, contactos, empresas, tareas y módulos personalizados) guarda en `UserPreference`, por usuario y módulo:
  - Lista o Kanban
  - vista guardada
  - filtros, columnas y orden
- **Cuándo se restaura:**
  - Al entrar al módulo sin parámetros: desde el menú, desde otro módulo o al recargar.
  - Limpiar filtros dentro de la lista no restaura nada.
- Si la vista guardada fue borrada, se usa la vista por defecto conservando Lista/Kanban y columnas.
- Esto resuelve el caso de Ventas, que volvía a Kanban aunque se hubiera elegido Lista.

## 5. Espacio en escritorio

- El contenedor pasa de 1280 px a 1760 px. Los formularios mantienen su ancho de lectura.
- Las tablas son un poco más densas.
- Las fichas usan 4 columnas en pantallas grandes.
- Contactos y Empresas muestran columnas extra (Responsable y fechas) cuando hay espacio.
- No hay scroll horizontal en móvil (verificado a 390 px).

## 6. Informes con varios paneles

- **Pestañas:** "General" (el informe de siempre) y los paneles guardados.
- **Paneles:**
  - crear, renombrar y borrar;
  - compartir (requiere el permiso "Paneles compartidos");
  - elegir cuál se abre por defecto.
- **Componentes:**
  - Tipos: indicador (cantidad, suma o promedio), barras agrupadas por cualquier campo, evolución en el tiempo y tabla.
  - Se configuran con módulo, período, fecha de referencia, filtros Y/O y ancho.
- **Cálculo:**
  - Se hace en el servidor con el **alcance de quien mira**: un panel compartido nunca muestra registros que esa persona no podría ver.
  - Tiene un tope de 20.000 registros por módulo por panel; si se supera, el panel lo avisa.

## 7. Roles, equipos y permisos

- **Modelo** (`lib/access.ts`):
  - Permisos por módulo: ver, crear, editar, eliminar y exportar.
  - Alcance: todos, los de su equipo o solo los propios.
  - Permisos administrativos: campos y módulos, vistas compartidas, automatizaciones, paneles compartidos, importar y configuración general.
  - La clave `*` aplica a cualquier módulo no listado, incluidos los módulos personalizados que se creen después.
- **Roles del sistema** (editables y restaurables):
  - Administrador
  - Miembro: igual que antes, no elimina ni configura.
  - **Solo lectura**: para usuarios externos. Se puede elegir al invitar y se aplica al aceptar.
- **Roles propios:** se pueden crear, y cada persona puede tener **excepciones** sin cambiar de rol (ej.: un vendedor que sí puede eliminar leads).
- **Equipos con jerarquía:**
  - El responsable de un equipo ve también sus sub-equipos.
  - Los ciclos se bloquean en la UI y en el servidor.
- **Validación en el servidor (`lib/api-guard.ts`):**
  - `requireWorkspace({ admin | permission })`
  - `requireRecordAccess(ctx, módulo, id, acción)`
  - Se aplica en todas las rutas de registros, borrado masivo, búsqueda, selectores, exportaciones, informes, actividades, etiquetas, emails, tareas e imágenes.
  - Un `DELETE` directo sin permiso responde 403. Un registro fuera del alcance responde 404.
- **Dueño y gestión del equipo:** el dueño siempre tiene todo. Gestionar el equipo y los permisos sigue siendo de dueño o administrador del negocio, y nadie edita sus propios permisos.
- **UI:** Configuración → Equipos y permisos (matriz de roles, personas con excepciones y árbol de equipos). El menú y los botones se ocultan según los permisos.

## Pruebas

| Verificación | Resultado |
|---|---|
| `tsc --noEmit` | OK |
| `eslint` | sin warnings |
| `next build` | OK |
| `vitest` | 542 tests (30 nuevos: permisos, equipos y alcance, condiciones, borrado con permisos) |
| E2E de servicios contra Postgres real (`test/e2e/core.e2e.ts`) | 10 escenarios, todos OK (ver abajo) |
| Playwright contra `next start` | ver abajo |

Para correr el E2E de servicios:

```
DATABASE_URL=postgresql://…/base_de_prueba npx vitest run --config vitest.e2e.config.mts
```

Nunca correrlo contra producción: crea datos.

Escenarios E2E:
- relación inversa Colaboraciones → contacto;
- uno a uno bloqueado por la base;
- renombrar y quitar opciones en uso;
- "antes de guardar" exige el motivo;
- actualizar relacionados;
- regla que se modifica a sí misma (sin ciclo);
- alcance "propios" y "equipo" con jerarquía;
- panel agrupado por estado;
- preferencias de vista.

Playwright contra `next start`:
- todas las pantallas nuevas sin errores de consola;
- restauración de "Lista" al volver a Oportunidades;
- cuadro de "Faltan datos" al rechazar una colaboración, que guarda al completarlo;
- sin scroll horizontal en móvil.

## Pendiente

- **Calendario:** respeta los permisos ver/crear/editar/eliminar, pero no el alcance por equipo (los eventos se listan para todo el negocio).
- **Inicio:** las métricas del inicio (`modules/dashboard`) todavía no aplican el alcance.
- **Automatizaciones por tiempo:** solo existe la clásica "lead sin atención", que corre por cron. Las genéricas por fecha (ej. "3 días antes del vencimiento") requieren un cron que evalúe reglas.
- **Webhook** como acción de automatización: todavía no existe.
- **Importaciones:** se aplican las validaciones "antes de guardar" (una fila bloqueada queda como error). En los módulos personalizados, el evento "se crea" corre después de escribir los campos.
- **Alcance "equipo" o "propios":** los registros sin responsable no se ven (las altas sin responsable quedan a nombre de quien las crea).
- **`components/custom-fields/custom-fields-manager.tsx`:** quedó sin uso. Se puede borrar.

## Actualización (2026-10-25)

- **Acción "Enviar un email"** en automatizaciones:
  - Usa las plantillas de Configuración → Plantillas de email y el proveedor del negocio (Resend, o sandbox).
  - Destinatario: el registro (en oportunidades, su contacto), un campo email, el responsable o una dirección fija.
  - Variables de plantilla + `{{nombre}}` / `{{modulo}}`. Con una variable sin resolver no se envía.
  - Tope de 200 emails automáticos por negocio cada 24 h (`AUTOMATION_EMAIL_DAILY_LIMIT`).
  - Queda en el historial del registro y en la ejecución de la regla.
- **Campo "Archivo"** en módulos personalizados (`modules/records/files.ts`):
  - Bucket privado `record-files`, hasta 20 MB.
  - Tipos: PDF, Word, Excel, ZIP o imagen, verificados por firma.
  - Descarga con URL firmada de 2 minutos, como adjunto.
  - La plantilla Colaboraciones ahora trae "Documentación" como archivo y un link opcional. Los módulos ya creados pueden sumar el campo desde Módulos.
- **Menú:** Módulos, Automatizaciones e Integraciones salieron de Configuración a la sección **Construir** (`/dashboard/modulos`, `/dashboard/automatizaciones`, `/dashboard/integraciones`). Las rutas viejas redirigen (`next.config.ts`).
- **Vistas recordadas:** aplicar una vista conserva Lista/Kanban, columnas y pipeline si la vista no los define. El guardado ya no se pierde al salir rápido del módulo, y el doble montaje de desarrollo ya no borra la preferencia.
