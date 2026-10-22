import type { Metadata } from "next";
import Link from "next/link";

import { CONTACT_EMAIL, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Eliminación de datos",
  description: "Cómo eliminar tus datos de Nodo y desconectar Instagram o Google.",
};

const SUBJECT = encodeURIComponent("Eliminación de datos — Nodo");

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Eliminación de datos"
      updated="20 de octubre de 2026"
      intro={
        <p>
          Podés pedir que eliminemos tus datos de Nodo en cualquier momento. Según tu caso, algunas cosas las podés hacer vos mismo al instante y otras las
          hacemos nosotros a pedido. Ver también la <Link href="/privacidad">Política de privacidad</Link>.
        </p>
      }
    >
      <LegalSection id="instagram" title="Si conectaste tu cuenta de Instagram a Nodo">
        <ul>
          <li>
            <strong>Desde Nodo:</strong> Configuración → Integraciones → Instagram → <strong>Desconectar</strong> (solo dueños o administradores). Se borra en el acto el token de acceso
            guardado y Nodo deja de recibir mensajes.
          </li>
          <li>
            <strong>Desde Instagram:</strong> Configuración → Apps y sitios web → buscá «Kodexa Connect-IG» → <strong>Eliminar</strong>. Esto revoca el acceso
            aunque no tengas acceso a Nodo.
          </li>
          <li>
            Los leads y el historial que ya se crearon a partir de mensajes se eliminan a pedido, como se explica más abajo.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="contactos" title="Si escribiste a un negocio que usa Nodo">
        <p>
          Si le enviaste un mensaje o completaste un formulario de un negocio que usa Nodo, tus datos los administra ese negocio. Podés pedirle a él que los
          elimine, o escribirnos indicando el negocio y tu usuario de Instagram, email o teléfono, y lo gestionamos.
        </p>
      </LegalSection>

      <LegalSection id="cuenta" title="Si querés eliminar tu cuenta o todos tus datos">
        <p>
          Escribinos a <a href={`mailto:${CONTACT_EMAIL}?subject=${SUBJECT}`}>{CONTACT_EMAIL}</a> con el asunto «Eliminación de datos — Nodo», desde el email
          de tu cuenta, e indicá:
        </p>
        <ul>
          <li>tu nombre y el email de tu cuenta de Nodo (o tu usuario de Instagram, si no tenés cuenta);</li>
          <li>qué querés eliminar: tu cuenta, el espacio de trabajo del negocio o datos puntuales.</li>
        </ul>
        <p>
          Confirmamos la recepción dentro de los 5 días hábiles y completamos la eliminación dentro de los 30 días. Si sos dueño del negocio, eliminar el
          espacio de trabajo borra también sus leads, contactos, oportunidades y demás datos del CRM. Podemos conservar solo la información que la ley nos
          obligue a guardar.
        </p>
      </LegalSection>

      <LegalSection id="google" title="Si conectaste tu cuenta de Google">
        <p>
          Desde Nodo: Configuración → Integraciones → <strong>Desconectar Google</strong>. También podés revocar el acceso desde tu cuenta de Google, en
          Seguridad → Apps de terceros con acceso a la cuenta.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
