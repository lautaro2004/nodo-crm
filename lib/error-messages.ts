// Mensajes en castellano para los códigos de error de dominio que
// devuelve la API (ver domainErrorResponse en lib/api-guard.ts). Un solo
// lugar para que toda la UI diga lo mismo ante el mismo problema.
const MESSAGES: Record<string, string> = {
  company_not_found: "La empresa seleccionada ya no existe.",
  contact_not_found: "El contacto seleccionado ya no existe.",
  pipeline_not_found: "El pipeline ya no existe.",
  stage_not_found: "La etapa ya no existe. Recargá la página.",
  stage_not_in_pipeline: "Esa etapa pertenece a otro pipeline.",
  stage_required: "Al cambiar de pipeline también hay que elegir una etapa.",
  user_not_in_business: "El responsable elegido no es miembro de este espacio de trabajo.",
  invalid_status: "Ese estado no existe. Revisá la configuración de estados.",
  use_convert_endpoint: "Para marcar un lead como convertido usá la acción “Convertir”.",
  lead_already_converted: "Este lead ya fue convertido y no se puede cambiar de estado.",
  invalid_config: "La configuración de la regla no es válida.",
  forbidden: "No tenés permiso para hacer esto (solo dueños o administradores del espacio).",
  reason_required: "Este estado exige indicar un motivo.",
  invalid_reason: "Elegí uno de los motivos configurados para este estado.",
  status_key_taken: "Ya existe un estado con ese nombre.",
  status_in_use: "No se puede borrar: hay registros usando este estado. Cambialos de estado primero.",
  pipeline_in_use: "No se puede borrar: el pipeline tiene oportunidades.",
  stage_in_use: "No se puede borrar: la etapa tiene oportunidades.",
  not_found: "El registro ya no existe.",
  unauthenticated: "Tu sesión expiró. Volvé a iniciar sesión.",
  no_business: "No encontramos tu espacio de trabajo. Volvé a iniciar sesión.",
  no_workspace: "No encontramos tu espacio de trabajo. Volvé a iniciar sesión.",
  invalid_input: "Revisá los datos ingresados.",
};

export function errorMessage(code: string | undefined | null): string {
  return (code && MESSAGES[code]) || "No se pudo guardar el cambio. Probá de nuevo.";
}

export async function readApiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return errorMessage(body?.error);
}
