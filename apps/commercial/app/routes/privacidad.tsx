import type { Route } from "./+types/privacidad";

import { LegalPage } from "~/components/legal-page";

const UPDATED_AT = "17 de noviembre de 2026";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Aviso de privacidad · TuCatálogo" },
    {
      name: "description",
      content:
        "Qué datos tratamos en TuCatálogo, con qué finalidad, durante cuánto tiempo y cómo ejercer tus derechos.",
    },
  ];
}

export default function Privacidad() {
  return (
    <LegalPage title="Aviso de privacidad" updatedAt={UPDATED_AT}>
      <p>
        Este aviso explica qué datos personales tratamos cuando creas una tienda en
        TuCatálogo, con qué finalidad y durante cuánto tiempo. Está escrito para que se
        entienda sin conocimientos técnicos.
      </p>

      <h2>1. Quién trata tus datos</h2>
      <p>
        El titular del servicio TuCatálogo es quien decide sobre el tratamiento de los
        datos descritos aquí. Puedes contactar con nosotros desde el correo con el que
        creaste tu cuenta.
      </p>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>
          <strong>Datos de la cuenta:</strong> nombre, email y contraseña. La
          contraseña se guarda siempre como hash, nunca en texto plano.
        </li>
        <li>
          <strong>Datos de la tienda:</strong> nombre, identificador, tema, color,
          moneda, número de WhatsApp y los textos e imágenes que publiques.
        </li>
        <li>
          <strong>Datos técnicos:</strong> identificadores de sesión, fecha de acceso y
          un hash de tu dirección IP. Guardamos el hash (no la IP) para limitar abusos
          y proteger el registro.
        </li>
        <li>
          <strong>Verificación por correo:</strong> el código de 6 dígitos se guarda
          hasheado, con intentos y caducidad de 10 minutos. El código en claro solo
          viaja en el correo que te enviamos.
        </li>
      </ul>
      <p>
        No pedimos datos de pago ni datos de tus clientes: los pedidos se cierran en
        WhatsApp, fuera de esta plataforma.
      </p>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Crear y mantener tu cuenta y tu catálogo público.</li>
        <li>Verificar que el email es tuyo antes de publicar nada.</li>
        <li>Enviarte el código de verificación y, si lo pides, el enlace de recuperación.</li>
        <li>Prevenir abusos: límites de peticiones, verificación anti-bot e intentos de código.</li>
        <li>Responder a tus solicitudes de soporte.</li>
      </ul>
      <p>
        No usamos tus datos para publicidad ni los vendemos. No hay analítica de
        terceros ni píxeles de seguimiento en el catálogo.
      </p>

      <h2>4. Con qué base legal</h2>
      <p>
        Tratamos los datos necesarios para ejecutar el servicio que solicitas (crear y
        mantener tu catálogo). Los datos técnicos de seguridad se tratan por interés
        legítimo en proteger la plataforma. Los envíos por correo se basan en la
        necesidad de verificar tu cuenta o de atender tu solicitud.
      </p>

      <h2>5. Cookies</h2>
      <p>
        Solo usamos cookies técnicas. La sesión del panel es una cookie <em>host-only</em>{" "}
        del dominio de tu tienda, marcada como <code>HttpOnly</code> y{" "}
        <code>SameSite=Lax</code>; no se comparte entre tiendas ni con el resto del
        sitio. No usamos cookies de publicidad ni de analítica.
      </p>
      <p>
        El registro incorpora una verificación anti-bot de Cloudflare Turnstile, que
        puede establecer sus propias cookies técnicas para distinguir personas de bots.
      </p>

      <h2>6. Cuánto tiempo los conservamos</h2>
      <ul>
        <li>
          Mientras tu cuenta exista. Al eliminar la tienda se borran los datos asociados
          y la cuenta.
        </li>
        <li>
          Los intentos de registro sin verificar caducan a los 10 minutos y no crean
          ningún registro de tienda.
        </li>
        <li>
          Tras eliminar una tienda, el identificador queda bloqueado 90 días para evitar
          suplantaciones. No contiene datos personales.
        </li>
        <li>
          Los registros de auditoría de operaciones administrativas se conservan sin
          datos sensibles ni códigos.
        </li>
      </ul>

      <h2>7. Quién más puede ver los datos</h2>
      <p>
        Para operar el servicio usamos proveedores de infraestructura y de envío de
        correo (Cloudflare para el alojamiento, la base de datos y las imágenes, y
        Resend para los correos transaccionales). Solo acceden a lo necesario para
        prestar el servicio.
      </p>
      <p>
        El catálogo público es visible para cualquiera que tenga el enlace: incluye el
        nombre de la tienda, los productos, los precios y, si lo configuras, el número
        de WhatsApp. Revisa esa información antes de publicar.
      </p>

      <h2>8. Tus derechos</h2>
      <p>
        Puedes solicitar acceso a tus datos, su rectificación, su eliminación, la
        limitación del tratamiento y oponerte a él. También puedes actualizar tus datos
        desde el panel.
      </p>
      <p>
        Para ejercer estos derechos escríbenos desde el correo con el que creaste tu
        cuenta. Si consideras que no hemos atendido tu solicitud correctamente, puedes
        reclamar ante la autoridad de protección de datos de tu país.
      </p>

      <h2>9. Seguridad</h2>
      <ul>
        <li>Contraseñas con hash y códigos de verificación con hash y caducidad.</li>
        <li>Sesiones con cookie host-only, sin dominio compartido entre tiendas.</li>
        <li>Límites de intentos en registro, verificación y acceso.</li>
        <li>Imágenes servidas desde un host único, sin acceso directo a la base de datos.</li>
      </ul>

      <h2>10. Menores</h2>
      <p>
        El servicio no está dirigido a menores de edad. Si detectamos una cuenta de un
        menor sin autorización, la eliminaremos.
      </p>

      <h2>11. Cambios en este aviso</h2>
      <p>
        Si cambiamos la forma en que tratamos los datos, publicaremos la nueva versión
        aquí con su fecha. Si el cambio es sustancial, lo avisaremos en el panel.
      </p>
      <p>
        Consulta también los <a href="/terminos">términos del servicio</a>.
      </p>
    </LegalPage>
  );
}
