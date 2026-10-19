// Genera el Apps Script que el cliente pega en su planilla (Extensiones →
// Apps Script). El secreto NO va en el código: se carga como propiedad del
// script (NODO_SECRET), así no queda visible en la hoja ni al compartirla.

export function buildAppsScript(input: { endpoint: string; integrationName: string }): string {
  const name = input.integrationName.replace(/[\r\n*/]/g, " ").slice(0, 80);
  return `/**
 * Nodo CRM — envío automático de filas como leads
 * Integración: ${name}
 *
 * CONFIGURACIÓN (una sola vez):
 *  1. Configuración del proyecto (ícono ⚙) → Propiedades del script →
 *     agregá la propiedad NODO_SECRET con el secreto que te mostró Nodo.
 *  2. Si los datos no están en la primera pestaña, completá NODO_HOJA abajo.
 *  3. Ejecutá probarConexionNodo() y aceptá los permisos. Nodo va a mostrar
 *     los encabezados para que configures el mapeo.
 *  4. Con el mapeo listo y la integración activa en Nodo, ejecutá
 *     instalarActivadoresNodo().
 *
 * FORMULARIOS CON APPS SCRIPT: si tu formulario ya guarda las respuestas con
 * un script (doPost / onFormSubmit), llamá a enviarFilaANodo(hoja, fila)
 * justo después de escribir la fila. Es la forma más confiable: los
 * activadores de cambios no siempre se disparan cuando otro script o una
 * API escribe en la hoja.
 *
 * FILAS CON ERROR: no se reenvían solas. Corregí los datos y borrá la celda
 * "Nodo estado" de esa fila, o ejecutá reintentarErroresNodo().
 */

const NODO_URL = "${input.endpoint}";
const NODO_HOJA = ""; // nombre de la pestaña; vacío = la primera
const NODO_COL_ID = "Nodo ID";
const NODO_COL_ESTADO = "Nodo estado";
const NODO_LOTE = 50;
const NODO_MAX_POR_CORRIDA = 500;

function hojaNodo_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = NODO_HOJA ? ss.getSheetByName(NODO_HOJA) : ss.getSheets()[0];
  if (!hoja) throw new Error("No existe la pestaña " + NODO_HOJA);
  return hoja;
}

// Agrega (si faltan) las columnas de control al final y devuelve sus índices.
function columnasNodo_(hoja) {
  const ultima = Math.max(hoja.getLastColumn(), 1);
  const encabezados = hoja.getRange(1, 1, 1, ultima).getDisplayValues()[0];
  let colId = encabezados.indexOf(NODO_COL_ID) + 1;
  let colEstado = encabezados.indexOf(NODO_COL_ESTADO) + 1;
  if (!colId) {
    colId = hoja.getLastColumn() + 1;
    hoja.getRange(1, colId).setValue(NODO_COL_ID);
  }
  if (!colEstado) {
    colEstado = hoja.getLastColumn() + 1;
    hoja.getRange(1, colEstado).setValue(NODO_COL_ESTADO);
  }
  const todos = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getDisplayValues()[0];
  return { colId: colId, colEstado: colEstado, encabezados: todos };
}

function firmaNodo_(timestamp, cuerpo) {
  const secreto = PropertiesService.getScriptProperties().getProperty("NODO_SECRET");
  if (!secreto) throw new Error("Falta la propiedad del script NODO_SECRET.");
  const bytes = Utilities.computeHmacSha256Signature(timestamp + "." + cuerpo, secreto, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
}

function enviarNodo_(datos) {
  const cuerpo = JSON.stringify(datos);
  const timestamp = String(Date.now());
  const respuesta = UrlFetchApp.fetch(NODO_URL, {
    method: "post",
    contentType: "application/json; charset=utf-8",
    payload: cuerpo,
    headers: { "X-Nodo-Timestamp": timestamp, "X-Nodo-Signature": firmaNodo_(timestamp, cuerpo) },
    muteHttpExceptions: true,
  });
  let json = {};
  try { json = JSON.parse(respuesta.getContentText()); } catch (e) {}
  return { codigo: respuesta.getResponseCode(), json: json };
}

/** Prueba la conexión y le informa a Nodo los encabezados de la hoja. */
function probarConexionNodo() {
  const hoja = hojaNodo_();
  const cols = columnasNodo_(hoja);
  const r = enviarNodo_({
    test: true,
    spreadsheetName: SpreadsheetApp.getActiveSpreadsheet().getName(),
    sheetName: hoja.getName(),
    headers: cols.encabezados.filter(function (h) { return h && h !== NODO_COL_ID && h !== NODO_COL_ESTADO; }),
  });
  if (r.codigo === 200) Logger.log("Conexión OK. Volvé a Nodo para configurar el mapeo.");
  else Logger.log("Nodo respondió " + r.codigo + ": " + JSON.stringify(r.json));
  return r.codigo === 200;
}

/** Envía UNA fila (usar desde el script de un formulario). */
function enviarFilaANodo(hoja, numeroFila) {
  hoja = hoja || hojaNodo_();
  const cols = columnasNodo_(hoja);
  enviarFilas_(hoja, cols, [numeroFila]);
}

/** Envía todas las filas que todavía no se enviaron. */
function sincronizarNodo() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const hoja = hojaNodo_();
    const cols = columnasNodo_(hoja);
    const ultimaFila = hoja.getLastRow();
    if (ultimaFila < 2) return;
    const estados = hoja.getRange(2, cols.colEstado, ultimaFila - 1, 1).getDisplayValues();
    const pendientes = [];
    for (let i = 0; i < estados.length && pendientes.length < NODO_MAX_POR_CORRIDA; i++) {
      if (!estados[i][0]) pendientes.push(i + 2);
    }
    for (let i = 0; i < pendientes.length; i += NODO_LOTE) {
      if (!enviarFilas_(hoja, cols, pendientes.slice(i, i + NODO_LOTE))) break;
    }
  } finally {
    lock.releaseLock();
  }
}

/** Vuelve a enviar las filas marcadas con error. */
function reintentarErroresNodo() {
  const hoja = hojaNodo_();
  const cols = columnasNodo_(hoja);
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return;
  const estados = hoja.getRange(2, cols.colEstado, ultimaFila - 1, 1).getDisplayValues();
  for (let i = 0; i < estados.length; i++) {
    if (String(estados[i][0]).indexOf("error") === 0) hoja.getRange(i + 2, cols.colEstado).clearContent();
  }
  sincronizarNodo();
}

// Devuelve false si hay que cortar (credenciales, pausa o límite).
function enviarFilas_(hoja, cols, numeros) {
  const filas = [];
  numeros.forEach(function (n) {
    const valores = hoja.getRange(n, 1, 1, cols.encabezados.length).getDisplayValues()[0];
    const tieneDatos = valores.some(function (v, i) { return v && i + 1 !== cols.colId && i + 1 !== cols.colEstado; });
    if (!tieneDatos) return;
    let id = valores[cols.colId - 1];
    if (!id) {
      id = Utilities.getUuid();
      hoja.getRange(n, cols.colId).setValue(id);
    }
    const datos = {};
    cols.encabezados.forEach(function (h, i) {
      if (h && i + 1 !== cols.colId && i + 1 !== cols.colEstado) datos[h] = valores[i];
    });
    filas.push({ numero: n, rowId: id, values: datos });
  });
  if (!filas.length) return true;

  const r = enviarNodo_({ rows: filas.map(function (f) { return { rowId: f.rowId, values: f.values }; }) });
  if (r.codigo !== 200) {
    Logger.log("Nodo respondió " + r.codigo + ": " + JSON.stringify(r.json));
    return false;
  }
  const porId = {};
  (r.json.results || []).forEach(function (x) { porId[x.rowId] = x; });
  filas.forEach(function (f) {
    const x = porId[f.rowId];
    if (!x || x.status === "in_progress") return; // se reintenta en la próxima corrida
    const texto = x.status === "failed" ? "error: " + (x.error || "desconocido") : "ok " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM HH:mm");
    hoja.getRange(f.numero, cols.colEstado).setValue(texto.slice(0, 250));
  });
  return true;
}

/** Instala los activadores: al cambiar la hoja y cada 5 minutos. */
function instalarActivadoresNodo() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const f = t.getHandlerFunction();
    if (f === "alCambiarNodo" || f === "sincronizarNodo") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("alCambiarNodo").forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onChange().create();
  // Respaldo: filas escritas por otros scripts o integraciones (que no
  // disparan onChange) se envían en la siguiente corrida.
  ScriptApp.newTrigger("sincronizarNodo").timeBased().everyMinutes(5).create();
  Logger.log("Activadores instalados.");
}

function alCambiarNodo(e) {
  sincronizarNodo();
}
`;
}
