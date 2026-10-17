# Campos personalizados y módulos personalizados — auditoría y propuesta

Estado: **etapas 1 y 2 implementadas** (PR `nodo/campos-importacion`). **Etapas 3 a 7 propuestas, pendientes de aprobación.** No se tocó el esquema de la base.

---

## 1. Bug: campos creados en la importación que no se veían

### Cómo se reprodujo
Pasos, en local:
1. Importar leads.
2. Crear "Rubro" (texto) y "Fecha alta" (fecha) desde el mapeo del importador.
3. Abrir el lead.

Resultado:
- **Persistencia:** OK. Los valores estaban en `CustomFieldValue`.
- **Detalle:** el campo no aparecía.
- **Volver a crear el mismo campo:** `500`. El importador lo ignoraba en silencio.

### Causas raíz
| # | Dónde | Problema |
|---|---|---|
| 1 | Renderizado | Solo el detalle de **Empresa** mostraba campos personalizados. Lead, Contacto y Oportunidad nunca los renderizaban: el dato existía pero no tenía pantalla. **Causa principal.** |
| 2 | Persistencia | Los valores se guardaban tal cual venían del archivo (`15/03/2026`, `Sí`, `1.234,50`). Un `<input type="date">` no muestra `15/03/2026`: una fecha importada se veía vacía aunque estuviera guardada. |
| 3 | Mapeo | Si el campo ya existía (con la misma clave), crearlo de nuevo daba `500` y el wizard no mostraba ningún error. Al reimportar, el campo existente tampoco se sugería. |
| 4 | Listas | No había forma de agregar un campo personalizado como columna (ni en la lista ni en el CSV). |
| 5 | Editor | Todos los tipos se editaban como texto libre, sin validación. Se podía guardar "abc" en un número. |
| 6 | Aislamiento | `POST /api/custom-field-values` validaba la definición pero **no el registro**: se podía colgar un valor de un `entityId` arbitrario, incluso de otro módulo. No había fuga de datos, porque la definición es del negocio que escribe, pero sí basura. |
| 7 | Integridad | Al borrar un registro quedaban `CustomFieldValue` y `EntityTag` huérfanos: son polimórficos y no tienen FK. |

### Qué se cambió (sin migración y sin tocar datos existentes)
- **`lib/custom-fields.ts`**: única implementación de validar, normalizar y formatear valores. La usan el importador (preview y servidor), el editor, la API, los filtros y el CSV. Forma canónica:
  - fechas: `aaaa-mm-dd`
  - sí/no: `true`/`false`
  - números: `1234.5`
  - Los datos viejos sin normalizar se siguen leyendo y mostrando bien: no se reescribió nada.
- **Detalle:** nueva tarjeta "Campos personalizados" en Lead, Contacto, Empresa y Oportunidad. Muestra todas las definiciones del módulo, tengan o no valor.
  - Editor por tipo: selector de fecha, Sí/No, lista, chips para opciones múltiples.
  - Valida y muestra el error.
  - Admins ven el link "Administrar campos".
- **Importador:**
  - crear un campo que ya existe con el mismo tipo devuelve el existente (`200`, "Ya existía el campo…"), sin duplicar;
  - con otro tipo da un error claro (`409 field_key_taken`);
  - al subir el archivo, las columnas que coinciden con un campo existente se mapean solas;
  - el resultado explica dónde ver los campos y ofrece "Ver leads/contactos/empresas", con recarga completa y sin caché.
- **Listas (Leads y Oportunidades):** los campos personalizados aparecen en "Columnas".
  - Ninguno se agrega por defecto.
  - Quedan en la URL y en las vistas guardadas.
  - Solo se cargan los valores de las columnas visibles, en una consulta.
- **CSV:** respeta esas columnas. Sin `cols` exporta todo, incluidos los personalizados.
- **Filtros:** Sí/No y fecha con control propio. Tolera formatos equivalentes (`sí` ≈ `true`, `15/03/2026` ≈ `2026-03-15`) y valida negocio y módulo de la definición.
- **API de valores:** verifica que el registro sea del negocio y del módulo del campo. Vacío borra el valor.
- **Borrado de registros:** limpia sus valores personalizados y etiquetas (`modules/records/cleanup.ts`).

### Pendiente de esta etapa
- Las listas de **Contactos** y **Empresas** todavía no tienen vistas configurables (columnas y filtros), así que ahí los campos solo se ven en el detalle. Se resuelve naturalmente con la etapa 6, que lleva la barra de lista genérica a todos los módulos.
- El **Kanban** no muestra campos personalizados en las tarjetas.
- Los formularios de **alta** ("Nuevo lead") no piden campos personalizados: se completan en el detalle después de crear.

---

## 2. Auditoría del sistema de campos personalizados

| Aspecto | Estado actual |
|---|---|
| Modelo | `CustomFieldDefinition` (businessId, entityType, key, label, type, options[], required, order), único por `(businessId, entityType, key)`. `CustomFieldValue` (definitionId, entityId, value TEXT), único por `(definitionId, entityId)`. EAV clásico. |
| Tipos | text, number, currency, date, datetime, boolean, select, multiselect, email, phone, url. No hay imagen, archivo ni relación. |
| Módulos | `entityType` es un string libre. La API acepta lead, contact, company y opportunity; el servicio también tipa `task`, pero ninguna pantalla lo usa. |
| Validación | Ahora es una sola (`lib/custom-fields.ts`). **`required` no se hace cumplir** en ningún lado. `options` se puede dejar vacío en select (acepta cualquier valor). |
| Renderizado | Ahora: detalle de los 4 módulos. Faltan: formularios de alta y Kanban. |
| Filtros | Leads y Oportunidades: `contains` sobre el texto, más equivalencias por tipo. No se puede ordenar por campo personalizado. |
| Importación | Leads, Contactos y Empresas. Crea campos en el momento. Sin Oportunidades. |
| Exportación | Leads y Oportunidades. |
| Aislamiento | Por `definition.businessId`. `CustomFieldValue` no tiene businessId propio: todo acceso tiene que pasar por la definición (ahora también se valida el registro). |
| Edición de definiciones | Solo crear y borrar. No se puede renombrar, reordenar ni editar opciones desde la UI, aunque la API `PATCH` existe. Cambiar el tipo no está permitido, y está bien así. |
| Rendimiento | Una consulta por filtro de campo (subconsulta de ids). Bien hasta decenas de miles de valores. Las listas **no están paginadas**: cargan todos los registros. Es el cuello de botella real antes que los campos. |

**Conclusión:** el modelo EAV sirve como base de los módulos personalizados sin duplicar lógica. Para que sea "el" sistema de campos de cualquier módulo le faltan:
1. Poder colgar definiciones de un módulo creado por el usuario (no solo de los 4 fijos).
2. Un tipo `image`.
3. Un tipo `relation` (que no se guarda como texto).
4. Que `required` se haga cumplir.
5. Paginación en las listas.

---

## 3. Propuesta: módulos personalizados (requiere aprobación)

### Principios
- **Metadatos, no tablas por módulo.** Un "Productos" o "Propiedades" es una fila en `CustomModule` y sus registros son filas en `CustomRecord`. Sin DDL en tiempo de ejecución ni migraciones por cliente.
- **Un solo sistema de campos.** Los campos de un módulo personalizado son `CustomFieldDefinition` con `entityType = "cm:<moduleId>"`. Editor, importador, filtros, columnas y CSV ya funcionan con `entityType`, así que se reutilizan tal cual.
- **El núcleo no se toca.** Leads, Contactos, Empresas y Oportunidades siguen siendo tablas propias, con sus pipelines, estados, tareas y actividades.

### Cambios de base de datos (esquema `crm`, todos aditivos)
```prisma
model CustomModule {
  id            String    @id @default(cuid())   // identificador estable (no cambia al renombrar)
  businessId    String
  key           String                           // slug estable para URLs: /dashboard/m/productos
  labelSingular String
  labelPlural   String
  description   String?
  icon          String?
  order         Int       @default(0)
  archivedAt    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  @@unique([businessId, key])
}

model CustomRecord {
  id         String    @id @default(cuid())
  businessId String
  moduleId   String                              // FK CustomModule (Cascade)
  title      String                              // "Nombre": búsqueda, selectores y listas sin EAV
  ownerId    String?
  archivedAt DateTime?
  createdById String?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  @@index([businessId, moduleId, archivedAt])
}

// CustomFieldDefinition: 3 columnas nuevas, todas opcionales
//   moduleId     String?  FK CustomModule (Cascade) — integridad para "cm:<id>"
//   targetEntity String?  solo para type "relation": "contact" | "company" | "opportunity" | "cm:<id>"
//   multiple     Boolean  @default(false) — relación a uno o a muchos

model RecordLink {                                // valores de los campos "relation"
  id           String   @id @default(cuid())
  businessId   String
  definitionId String                              // el campo relación (FK, Cascade)
  fromType     String   // "cm:<id>" | "opportunity" | …
  fromId       String
  toType       String
  toId         String
  createdAt    DateTime @default(now())
  @@unique([definitionId, fromId, toId])
  @@index([businessId, toType, toId])              // consulta inversa: "¿qué apunta a este contacto?"
}

model OpportunityItem {                           // productos de una oportunidad, con precio histórico
  id            String   @id @default(cuid())
  businessId    String
  opportunityId String                             // FK Opportunity (Cascade)
  recordId      String?                            // FK CustomRecord (SetNull): el producto puede borrarse
  nameSnapshot  String                             // nombre al momento de agregarlo
  unitPrice     Float                              // precio aplicado: NO se recalcula si cambia el catálogo
  quantity      Float    @default(1)
  createdAt     DateTime @default(now())
  @@index([opportunityId])
}
```
Ningún cambio borra ni modifica datos existentes. La migración es aditiva e idempotente, como las anteriores.

### Tipos de campo nuevos
- **`image`**: sube a Supabase Storage, en un bucket privado con URL firmada, igual que los adjuntos de tareas. El valor guarda la ruta del archivo.
- **`relation`**: elige uno o varios registros de otro módulo. Se guarda en `RecordLink`, no en `CustomFieldValue`. La relación es explícita, persistente y consultable desde los dos lados: el contacto ve "Productos relacionados", "Citas", etc. **No se copian registros.**

### Relaciones para los primeros casos
| Caso | Cómo |
|---|---|
| Oportunidad → Contacto | **Ya existe** (`Opportunity.contactId`). Se mantiene como está. |
| Contacto → sus oportunidades | **Ya existe** en el detalle del contacto. |
| Oportunidad ↔ Productos (muchos a muchos con precio) | `OpportunityItem`: un selector en la oportunidad muestra nombre, precio, código e imagen, si el módulo tiene esos campos. Se elige el campo precio del módulo una vez. |
| Producto → oportunidades | El detalle del producto lista las oportunidades donde aparece, filtrando por las que el usuario puede ver. |
| Cita → Contacto, Propiedad → Contacto, etc. | Campo `relation` en el módulo personalizado (uno a muchos). Se muestra inverso en el contacto. |

Uno a uno no hace falta todavía: se modela como relación a uno.

### Importes históricos
- Al agregar un producto a una oportunidad se **copian** el nombre y el precio actual a `OpportunityItem`. Cambiar el precio del catálogo **no** altera oportunidades existentes.
- Oportunidades **cerradas** (ganada o perdida): no se recalculan nunca.
- **Decisión que necesito**, con oportunidades abiertas:
  - **A)** el valor de la oportunidad se calcula solo como suma de los productos mientras esté abierta, si tiene productos;
  - **B)** el valor sigue siendo manual y aparece "Usar total de productos ($X)".

### Permisos
- **Crear, editar o borrar módulos y campos:** dueño o admin.
- **Registros:**
  - cualquier miembro con acceso a Nodo crea, edita y archiva;
  - borrar definitivamente es solo para admin, igual que hoy en los módulos estándar.
- **Aislamiento:** todo filtrado por `businessId`, que se resuelve de la sesión, nunca del cliente. `moduleId`, `definitionId` y `recordId` se revalidan contra el negocio en cada operación, con el mismo criterio que la API de valores de esta PR. Los tests de aislamiento cubren lectura, escritura, relación cruzada y exportación.

### Interfaz
- **Configuración → Módulos:**
  - crear con nombre, descripción e ícono;
  - agregar, reordenar y editar campos (con el editor actual, mejorado);
  - archivar el módulo.
  - Se ofrecen plantillas opcionales, por ejemplo "Productos" con nombre, precio, código, descripción e imagen. Ningún módulo es obligatorio.
- **Navegación:** sección "Módulos" en el sidebar con los módulos activos del negocio.
- **Por módulo:** lista con la misma barra que Leads (buscar, filtros, columnas, vistas guardadas, CSV), paginada de 50 en 50, más el detalle y el formulario del registro.
- **Importar:** el módulo aparece como opción. "Nombre" es el campo estándar y el resto se mapea a sus campos, o se crean en el momento (motor actual extendido, no duplicado).

### Límites iniciales (configurables)
- 20 módulos por negocio.
- 100 campos por módulo.
- 2000 filas por importación (igual que hoy).
- Paginación obligatoria en módulos personalizados.

### Plan de entrega propuesto
1. **Migración aditiva**, a aplicar con tu autorización, y servicios con tests de aislamiento.
2. **Configuración de módulos y campos**, más el CRUD de registros, la lista paginada y el detalle. Con esto ya se puede **crear Productos y cargar registros con imagen**.
3. **`OpportunityItem`:** productos en la oportunidad con precio histórico, y la vista inversa en el producto.
4. **Campo `relation` genérico** con `RecordLink`, y la vista inversa en Contacto y Empresa.
5. **Importar y exportar** por módulo, y búsqueda global.
6. **Llevar la barra de lista genérica** a Contactos y Empresas (cierra el pendiente de la etapa 1).

### Alternativa evaluada y descartada
- **JSONB en `CustomRecord.data`:** filtra y ordena mejor con índice GIN, pero obligaría a mantener dos sistemas de campos (EAV para los módulos estándar y JSONB para los personalizados) y a duplicar validación, importador y filtros. Si el volumen lo pide más adelante, se puede agregar una columna JSONB "cache" sin cambiar la API.
- **Tabla SQL por módulo:** DDL en producción por cada cliente, migraciones divergentes y riesgo de seguridad. Sin justificación para este volumen.
