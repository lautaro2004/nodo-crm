// Genera el Apps Script que el cliente pega en su planilla.
//
// Convivencia con otros scripts de la misma planilla: en Apps Script todos
// los archivos de un proyecto comparten el mismo espacio global, así que
// una función `sincronizar()` o una constante `URL` podrían pisar (o ser
// pisadas por) código que el cliente ya tiene. Por eso:
// - todo el código vive dentro de un único objeto `NodoCRM` (IIFE);
// - las únicas funciones globales son las que Apps Script necesita ver
//   (para ejecutarlas desde el editor o como activadores), y todas llevan el
//   prefijo `nodoCRM_`;
// - el secreto se guarda en una propiedad del script con nombre propio;
// - el instalador de activadores solo toca los activadores de Nodo.
// El secreto NUNCA va en el código.

export const APPS_SCRIPT_FILE_NAME = "NodoCRM";
export const APPS_SCRIPT_SECRET_PROPERTY = "NODO_CRM_SECRET";
export const APPS_SCRIPT_FUNCTIONS = {
  test: "nodoCRM_probarConexion",
  install: "nodoCRM_instalarActivadores",
  sync: "nodoCRM_sincronizar",
  retry: "nodoCRM_reintentarErrores",
  sendRow: "nodoCRM_enviarFila",
  onChange: "nodoCRM_alCambiar",
} as const;

export function buildAppsScript(input: { endpoint: string; integrationName: string }): string {
  // Solo se neutraliza lo que podría cerrar el comentario ("*/") o cortar la línea.
  const name = input.integrationName.replace(/[\r\n]/g, " ").replace(/\*\//g, "* /").slice(0, 120);
  const F = APPS_SCRIPT_FUNCTIONS;
  return `/**
 * ─────────────────────────────────────────────────────────────────────
 * Nodo CRM — envío automático de filas como leads
 * Integración: ${name}
 * ─────────────────────────────────────────────────────────────────────
 * Pegá este código en un ARCHIVO NUEVO del editor de Apps Script
 * (por ejemplo "${APPS_SCRIPT_FILE_NAME}"). No reemplaces ni borres el código
 * que ya tengas: todo lo de Nodo vive dentro del objeto NodoCRM y sus
 * funciones empiezan con "nodoCRM_", así que no interfiere con otros scripts.
 *
 * PASOS (una sola vez):
 *  1. Configuración del proyecto (⚙) → Propiedades del script → agregá
 *     ${APPS_SCRIPT_SECRET_PROPERTY} con el secreto que te mostró Nodo.
 *  2. Si los datos no están en la primera pestaña, completá "hoja" abajo.
 *  3. Elegí la función ${F.test} y tocá "Ejecutar". Aceptá los permisos.
 *  4. En Nodo: mapeá las columnas y activá la integración.
 *  5. Elegí la función ${F.install} y tocá "Ejecutar".
 *
 * SI TU FORMULARIO YA GUARDA LAS RESPUESTAS CON UN SCRIPT (doPost /
 * onFormSubmit): justo después de escribir la fila, agregá
 *     ${F.sendRow}(hoja, numeroDeFila);
 * Es lo más confiable: los activadores de cambios no siempre se disparan
 * cuando otro script o una API escribe en la hoja.
 *
 * FILAS CON ERROR: no se reenvían solas. Corregí los datos y borrá la celda
 * "Nodo estado" de esa fila, o ejecutá ${F.retry}.
 */
var NodoCRM = (function () {
  var CONFIG = {
    url: "${input.endpoint}",
    hoja: "", // nombre de la pestaña; vacío = la primera
    propiedadSecreto: "${APPS_SCRIPT_SECRET_PROPERTY}",
    colId: "Nodo ID",
    colEstado: "Nodo estado",
    lote: 50,
    maxPorCorrida: 500,
    activadores: ["${F.onChange}", "${F.sync}"],
  };

  function hoja() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var h = CONFIG.hoja ? ss.getSheetByName(CONFIG.hoja) : ss.getSheets()[0];
    if (!h) throw new Error("Nodo CRM: no existe la pestaña " + CONFIG.hoja);
    return h;
  }

  // Agrega (si faltan) las columnas de control al final y devuelve sus índices.
  function columnas(h) {
    var ultima = Math.max(h.getLastColumn(), 1);
    var encabezados = h.getRange(1, 1, 1, ultima).getDisplayValues()[0];
    var colId = encabezados.indexOf(CONFIG.colId) + 1;
    var colEstado = encabezados.indexOf(CONFIG.colEstado) + 1;
    if (!colId) {
      colId = h.getLastColumn() + 1;
      h.getRange(1, colId).setValue(CONFIG.colId);
    }
    if (!colEstado) {
      colEstado = h.getLastColumn() + 1;
      h.getRange(1, colEstado).setValue(CONFIG.colEstado);
    }
    var todos = h.getRange(1, 1, 1, h.getLastColumn()).getDisplayValues()[0];
    return { colId: colId, colEstado: colEstado, encabezados: todos };
  }

  function esDeControl(cols, indice) {
    return indice + 1 === cols.colId || indice + 1 === cols.colEstado;
  }

  function firma(timestamp, cuerpo) {
    var secreto = PropertiesService.getScriptProperties().getProperty(CONFIG.propiedadSecreto);
    if (!secreto) throw new Error("Nodo CRM: falta la propiedad del script " + CONFIG.propiedadSecreto + ".");
    var bytes = Utilities.computeHmacSha256Signature(timestamp + "." + cuerpo, secreto, Utilities.Charset.UTF_8);
    return bytes.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
  }

  function enviar(datos) {
    var cuerpo = JSON.stringify(datos);
    var timestamp = String(Date.now());
    var respuesta = UrlFetchApp.fetch(CONFIG.url, {
      method: "post",
      contentType: "application/json; charset=utf-8",
      payload: cuerpo,
      headers: { "X-Nodo-Timestamp": timestamp, "X-Nodo-Signature": firma(timestamp, cuerpo) },
      muteHttpExceptions: true,
    });
    var json = {};
    try { json = JSON.parse(respuesta.getContentText()); } catch (e) {}
    return { codigo: respuesta.getResponseCode(), json: json };
  }

  // Devuelve false si hay que cortar (credenciales, pausa o límite).
  function enviarFilas(h, cols, numeros) {
    var filas = [];
    numeros.forEach(function (n) {
      var valores = h.getRange(n, 1, 1, cols.encabezados.length).getDisplayValues()[0];
      var tieneDatos = valores.some(function (v, i) { return v && !esDeControl(cols, i); });
      if (!tieneDatos) return;
      var id = valores[cols.colId - 1];
      if (!id) {
        id = Utilities.getUuid();
        h.getRange(n, cols.colId).setValue(id);
      }
      var datos = {};
      cols.encabezados.forEach(function (encabezado, i) {
        if (encabezado && !esDeControl(cols, i)) datos[encabezado] = valores[i];
      });
      filas.push({ numero: n, rowId: id, values: datos });
    });
    if (!filas.length) return true;

    var r = enviar({ rows: filas.map(function (f) { return { rowId: f.rowId, values: f.values }; }) });
    if (r.codigo !== 200) {
      var motivo = (r.json && r.json.error) || "";
      if (motivo === "integration_not_active") Logger.log("Nodo CRM: la integración todavía no está activa. Activala en Nodo (Configuración → Integraciones) y volvé a ejecutar " + "${F.sync}" + ".");
      else if (motivo === "integration_paused") Logger.log("Nodo CRM: la integración está en pausa en Nodo. Las filas se envían cuando la reactives.");
      else if (r.codigo === 401) Logger.log("Nodo CRM: el secreto no coincide. Revisá la propiedad ${APPS_SCRIPT_SECRET_PROPERTY} (o regenerá el secreto en Nodo).");
      else Logger.log("Nodo CRM respondió " + r.codigo + ": " + JSON.stringify(r.json));
      return false;
    }
    var resumen = { ok: 0, error: 0 };
    var porId = {};
    (r.json.results || []).forEach(function (x) { porId[x.rowId] = x; });
    filas.forEach(function (f) {
      var x = porId[f.rowId];
      if (!x || x.status === "in_progress") return; // se reintenta en la próxima corrida
      var texto = x.status === "failed"
        ? "error: " + (x.error || "desconocido")
        : "ok " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM HH:mm");
      h.getRange(f.numero, cols.colEstado).setValue(texto.slice(0, 250));
      resumen[x.status === "failed" ? "error" : "ok"]++;
    });
    Logger.log("Nodo CRM: " + resumen.ok + " fila(s) enviadas" + (resumen.error ? ", " + resumen.error + " con error (ver columna «Nodo estado»)" : "") + ".");
    return true;
  }

  function probarConexion() {
    var h = hoja();
    var cols = columnas(h);
    var r = enviar({
      test: true,
      spreadsheetName: SpreadsheetApp.getActiveSpreadsheet().getName(),
      sheetName: h.getName(),
      headers: cols.encabezados.filter(function (e, i) { return e && !esDeControl(cols, i); }),
    });
    if (r.codigo === 200) Logger.log("Nodo CRM: conexión OK. Volvé a Nodo para configurar el mapeo.");
    else Logger.log("Nodo CRM respondió " + r.codigo + ": " + JSON.stringify(r.json));
    return r.codigo === 200;
  }

  // Desde el código de un formulario: enviarFila(hoja, numeroDeFila).
  // Ejecutada a mano desde el editor (sin datos): envía la fila
  // seleccionada en la planilla o, si no hay, la última.
  function enviarFila(h, numeroFila) {
    h = h || hoja();
    var n = Number(numeroFila);
    if (!n) {
      var activa = SpreadsheetApp.getActiveSpreadsheet().getActiveRange();
      n = activa && activa.getSheet().getName() === h.getName() ? activa.getRow() : h.getLastRow();
    }
    if (n < 2) {
      Logger.log("Nodo CRM: no hay filas con datos para enviar.");
      return;
    }
    enviarFilas(h, columnas(h), [n]);
  }

  function sincronizar() {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return;
    try {
      var h = hoja();
      var cols = columnas(h);
      var ultimaFila = h.getLastRow();
      if (ultimaFila < 2) return;
      var estados = h.getRange(2, cols.colEstado, ultimaFila - 1, 1).getDisplayValues();
      var pendientes = [];
      for (var i = 0; i < estados.length && pendientes.length < CONFIG.maxPorCorrida; i++) {
        if (!estados[i][0]) pendientes.push(i + 2);
      }
      for (var j = 0; j < pendientes.length; j += CONFIG.lote) {
        if (!enviarFilas(h, cols, pendientes.slice(j, j + CONFIG.lote))) break;
      }
    } finally {
      lock.releaseLock();
    }
  }

  function reintentarErrores() {
    var h = hoja();
    var cols = columnas(h);
    var ultimaFila = h.getLastRow();
    if (ultimaFila < 2) return;
    var estados = h.getRange(2, cols.colEstado, ultimaFila - 1, 1).getDisplayValues();
    for (var i = 0; i < estados.length; i++) {
      if (String(estados[i][0]).indexOf("error") === 0) h.getRange(i + 2, cols.colEstado).clearContent();
    }
    sincronizar();
  }

  // Solo borra/crea los activadores de Nodo; los demás del proyecto quedan igual.
  function instalarActivadores() {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (CONFIG.activadores.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger("${F.onChange}").forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onChange().create();
    // Respaldo: filas escritas por otros scripts o integraciones (que no
    // disparan onChange) se envían en la siguiente corrida.
    ScriptApp.newTrigger("${F.sync}").timeBased().everyMinutes(5).create();
    Logger.log("Nodo CRM: activadores instalados.");
  }

  return {
    probarConexion: probarConexion,
    enviarFila: enviarFila,
    sincronizar: sincronizar,
    reintentarErrores: reintentarErrores,
    instalarActivadores: instalarActivadores,
  };
})();

// ── Funciones que se ejecutan desde el editor o como activadores ──
function ${F.test}() { return NodoCRM.probarConexion(); }
function ${F.install}() { NodoCRM.instalarActivadores(); }
function ${F.sync}() { NodoCRM.sincronizar(); }
function ${F.retry}() { NodoCRM.reintentarErrores(); }
function ${F.sendRow}(hoja, numeroFila) { NodoCRM.enviarFila(hoja, numeroFila); }
function ${F.onChange}(e) { NodoCRM.sincronizar(); }
`;
}
