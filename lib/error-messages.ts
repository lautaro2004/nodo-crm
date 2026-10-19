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
  field_key_taken: "Ya existe un campo con ese nombre y otro tipo. Elegí otro nombre o usá el campo existente.",
  module_not_found: "Ese módulo ya no existe.",
  record_not_found: "Ese registro ya no existe.",
  too_many_fields: "Llegaste al máximo de campos para este módulo.",
  too_many_modules: "Llegaste al máximo de módulos para este espacio de trabajo.",
  relation_target_required: "Elegí a qué módulo apunta la relación.",
  invalid_relation: "Alguno de los registros relacionados no existe o es de otro módulo.",
  required_fields: "Completá los campos obligatorios.",
  invalid_value: "Revisá los valores cargados.",
  invalid_image_field: "Ese campo de imagen no es de este módulo.",
  file_too_large: "La imagen supera los 5 MB.",
  file_type_not_allowed: "Formato no permitido. Usá JPG, PNG, WebP o GIF.",
  file_empty: "El archivo está vacío.",
  file_required: "Elegí una imagen.",
  opportunity_not_found: "La oportunidad ya no existe.",
  opportunity_closed: "La oportunidad está cerrada: sus productos e importes no se modifican.",
  no_items: "La oportunidad no tiene productos.",
  archive_first: "Archivá el módulo antes de borrarlo.",
  module_archived: "El módulo está archivado. Restauralo para cargar registros.",
  invalid_role_field: "Ese campo no es de este módulo o no es del tipo adecuado.",
  already_member: "Esa persona ya es parte del equipo.",
  email_in_other_business: "Ese email ya pertenece a otro negocio. Por ahora cada usuario puede estar en un solo negocio: pedile que use otro email.",
  products_required: "Elegí al menos un producto (Nodo o Nexo).",
  product_not_available: "El negocio no tiene ese producto activo.",
  invitation_invalid: "El link de invitación no es válido.",
  invitation_expired: "La invitación venció. Pedí que te la vuelvan a enviar.",
  invitation_revoked: "La invitación fue cancelada.",
  invitation_accepted: "Esta invitación ya fue usada.",
  invitation_wrong_email: "Esta invitación es para otro email. Iniciá sesión con el email invitado.",
  no_access: "No tenés acceso a Nodo en este negocio.",
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
  network_error: "Sin conexión con el servidor. Revisá tu conexión y probá de nuevo.",
};

export function errorMessage(code: string | undefined | null): string {
  return (code && MESSAGES[code]) || "No se pudo guardar el cambio. Probá de nuevo.";
}

export async function readApiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return errorMessage(body?.error);
}
