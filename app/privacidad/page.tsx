import type { Metadata } from "next";
import Link from "next/link";

import { CONTACT_EMAIL, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos trata Nodo, el CRM de Kodexa, para qué los usa y cómo ejercer tus derechos.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de privacidad"
      updated="20 de octubre de 2026"
      intro={
        <p>
          Nodo es el CRM de <strong>Kodexa</strong> (en adelante, «Kodexa», «nosotros»). Esta política explica qué datos personales trata Nodo, con qué
          finalidad, con quién se comparten y cómo podés ejercer tus derechos. Aplica al sitio y a la aplicación web de Nodo, y a sus
          integraciones (Instagram, Google y Google Sheets).
        </p>
      }
    >
      <LegalSection title="1. Quién es responsable">
        <p>
          Kodexa es responsable de los datos de las cuentas de Nodo (las personas que usan el CRM). Respecto de los datos de clientes y prospectos que cada
          negocio carga o recibe en su espacio de trabajo, el negocio es el responsable y Kodexa actúa como prestador que los trata por su cuenta y siguiendo
          sus instrucciones.
        </p>
        <p>
          Contacto para temas de privacidad: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Qué datos tratamos">
        <ul>
          <li>
            <strong>Datos de la cuenta:</strong> nombre, email y contraseña (guardada cifrada con un algoritmo de hash, nunca en texto plano), negocio al que
            pertenecés, rol y datos de sesión.
          </li>
          <li>
            <strong>Datos del CRM:</strong> la información que el negocio carga o importa: empresas, contactos, leads, oportunidades, tareas, notas,
            actividades, archivos e imágenes adjuntas y campos personalizados.
          </li>
          <li>
            <strong>Instagram:</strong> si el negocio conecta su cuenta profesional, guardamos el identificador y el nombre de usuario de esa cuenta y un token
            de acceso (cifrado). De los mensajes directos que recibe la cuenta guardamos solo lo necesario para el CRM: el identificador de Instagram de quien
            escribe, su nombre o usuario si la API de Instagram lo informa, el texto del mensaje y la fecha. No accedemos a la contraseña de Instagram ni a
            otros datos de la cuenta.
          </li>
          <li>
            <strong>Google Sheets:</strong> si el negocio conecta una planilla, recibimos solo las columnas que configuró para importar (por ejemplo, nombre,
            email, teléfono o consulta). La planilla sigue siendo del negocio; Nodo no recibe acceso a su cuenta de Google.
          </li>
          <li>
            <strong>Google (Gmail y Calendar):</strong> si una persona conecta su cuenta de Google, guardamos su email de Google y un token cifrado, y usamos
            únicamente los permisos que autorizó (enviar emails desde Nodo; ver y gestionar eventos del calendario). No leemos la bandeja de entrada.
          </li>
          <li>
            <strong>Datos técnicos:</strong> registros de seguridad y funcionamiento (fecha, tipo de evento, errores). No incluyen el contenido de los mensajes
            ni tokens.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Para qué los usamos">
        <ul>
          <li>Prestar el servicio: gestionar clientes, leads y ventas del negocio dentro de su espacio de trabajo.</li>
          <li>Crear y actualizar leads automáticamente a partir de las integraciones que el negocio activa, evitando duplicados.</li>
          <li>Seguridad, prevención de abuso y soporte.</li>
          <li>Comunicaciones operativas del servicio (por ejemplo, invitaciones al equipo o avisos de la cuenta).</li>
        </ul>
        <p>
          <strong>No vendemos datos personales, no los usamos para publicidad</strong> y no los compartimos con terceros para sus propios fines. Los datos
          obtenidos de Instagram y de Google se usan exclusivamente para brindar las funciones de Nodo que el negocio habilitó, de acuerdo con las políticas
          de esas plataformas.
        </p>
      </LegalSection>

      <LegalSection title="4. Con quién se comparten">
        <p>Usamos proveedores que tratan datos por nuestra cuenta para operar el servicio:</p>
        <ul>
          <li>Supabase (base de datos y almacenamiento de archivos).</li>
          <li>Netlify (alojamiento de la aplicación).</li>
          <li>Resend (envío de emails transaccionales).</li>
          <li>Meta Platforms (Instagram) y Google, solo cuando el negocio conecta esas integraciones.</li>
        </ul>
        <p>
          Algunos de estos proveedores pueden almacenar datos fuera de Argentina. En esos casos trabajamos con proveedores que ofrecen garantías adecuadas de
          protección de datos. También podemos revelar datos si una ley o una autoridad competente lo exige.
        </p>
      </LegalSection>

      <LegalSection title="5. Seguridad">
        <p>
          Los datos viajan cifrados (HTTPS). Los tokens de acceso de Instagram y Google y los secretos de las integraciones se guardan cifrados en reposo. Cada
          negocio solo puede acceder a los datos de su propio espacio de trabajo, y el acceso dentro del negocio depende del rol de cada persona.
        </p>
      </LegalSection>

      <LegalSection title="6. Cuánto tiempo los conservamos">
        <p>
          Conservamos los datos mientras la cuenta o el espacio de trabajo estén activos, o mientras el negocio no los elimine. Al desconectar una integración,
          se borra el token de acceso guardado. Al pedir la baja de la cuenta, eliminamos o anonimizamos los datos dentro de los 30 días, salvo los que debamos
          conservar por obligación legal.
        </p>
      </LegalSection>

      <LegalSection title="7. Tus derechos">
        <p>
          Podés pedir acceso, rectificación, actualización o eliminación de tus datos personales escribiendo a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Si escribiste a un negocio que usa Nodo (por ejemplo, por Instagram), también podés
          dirigirte a ese negocio. Explicamos el procedimiento completo en{" "}
          <Link href="/eliminacion-de-datos">Eliminación de datos</Link>.
        </p>
        <p>
          La Agencia de Acceso a la Información Pública (AAIP), en su carácter de órgano de control de la Ley N.º 25.326, tiene la atribución de atender las
          denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales.
        </p>
      </LegalSection>

      <LegalSection title="8. Cambios en esta política">
        <p>
          Si cambiamos esta política, publicaremos la nueva versión en esta página con su fecha de actualización y, si el cambio es relevante, lo avisaremos
          dentro de Nodo o por email.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
