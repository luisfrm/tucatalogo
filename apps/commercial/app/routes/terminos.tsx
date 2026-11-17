import type { Route } from "./+types/terminos";

import { LegalPage } from "~/components/legal-page";

const UPDATED_AT = "17 de noviembre de 2026";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Términos del servicio · TuCatálogo" },
    {
      name: "description",
      content:
        "Condiciones de uso de TuCatálogo: cuenta, contenido del catálogo, pedidos por WhatsApp, uso aceptable y eliminación de la tienda.",
    },
  ];
}

export default function Terminos() {
  return (
    <LegalPage title="Términos del servicio" updatedAt={UPDATED_AT}>
      <p>
        Estos términos regulan el uso de TuCatálogo, un servicio para publicar el
        catálogo de una tienda y recibir pedidos por WhatsApp. Al crear una cuenta los
        aceptas.
      </p>

      <h2>1. Qué es TuCatálogo</h2>
      <p>
        TuCatálogo pone a tu disposición una página pública con tus productos y un
        panel privado para gestionarlos. No somos una tienda, no vendemos tus productos
        y no cobramos pedidos: la venta ocurre entre tú y tu cliente.
      </p>
      <p>
        Una cuenta corresponde a una sola tienda. El identificador que eliges forma
        parte del enlace público de tu catálogo.
      </p>

      <h2>2. Tu cuenta</h2>
      <ul>
        <li>Debes dar datos veraces y mantener actualizado tu email.</li>
        <li>
          La contraseña es personal: eres responsable de lo que ocurra con las
          credenciales de tu cuenta.
        </li>
        <li>
          Verificamos el email con un código de 6 dígitos antes de crear la tienda. Sin
          esa verificación no existe cuenta ni catálogo.
        </li>
        <li>
          Puedes usar el mismo email en otros servicios: aquí es una identidad
          independiente.
        </li>
      </ul>

      <h2>3. Tu catálogo y tu contenido</h2>
      <p>
        El contenido que subes (nombre de la tienda, textos, precios, imágenes) es
        tuyo. Nos das permiso únicamente para almacenarlo y mostrarlo en tu catálogo
        público mientras la tienda exista.
      </p>
      <ul>
        <li>Debes tener derecho a usar las imágenes que subes.</li>
        <li>
          Los precios se guardan en la moneda que elijas y en unidad mínima; no
          hacemos conversión de moneda.
        </li>
        <li>
          No está permitido publicar contenido ilegal, engañoso, violento, sexual,
          discriminatorio o que vulnere derechos de terceros.
        </li>
      </ul>

      <h2>4. Pedidos y pagos</h2>
      <p>
        Los pedidos se envían a tu WhatsApp. TuCatálogo no intermedia en el pago, el
        envío ni la garantía: esas condiciones las acuerdas directamente con tu
        cliente. Tampoco cobramos comisión por pedido.
      </p>

      <h2>5. Uso aceptable</h2>
      <ul>
        <li>No intentes acceder a tiendas o cuentas que no son tuyas.</li>
        <li>
          No uses el servicio para enviar spam ni para automatizar peticiones de
          verificación.
        </li>
        <li>
          No intentes eludir los límites de uso, los mecanismos anti-bot ni la
          verificación por correo.
        </li>
      </ul>

      <h2>6. Disponibilidad y cambios</h2>
      <p>
        Trabajamos para que el servicio esté disponible, pero puede interrumpirse por
        mantenimiento o por causas ajenas. Podemos cambiar funcionalidades y, si el
        cambio es relevante, lo avisaremos en el panel.
      </p>

      <h2>7. Suspensión y eliminación</h2>
      <p>
        Puedes suspender tu tienda cuando quieras: el catálogo público deja de verse y
        el panel sigue funcionando para que puedas reactivarla.
      </p>
      <p>
        También puedes eliminar la tienda por completo. Al hacerlo se borran los datos
        de la tienda y la cuenta asociada, y el identificador queda reservado durante
        90 días para evitar que otra persona lo use de inmediato.
      </p>
      <p>
        Podemos suspender una tienda si detectamos un uso que incumpla estos términos o
        la ley aplicable. En ese caso verás el motivo en el panel.
      </p>

      <h2>8. Responsabilidad</h2>
      <p>
        El servicio se ofrece tal cual. En la medida en que la ley lo permita, no
        respondemos por lucro cesante ni por daños indirectos derivados del uso del
        catálogo o de las conversaciones de WhatsApp.
      </p>

      <h2>9. Cambios en los términos</h2>
      <p>
        Si modificamos estos términos publicaremos la nueva versión en esta página con
        su fecha. Si el cambio afecta de forma sustancial al uso del servicio, lo
        comunicaremos en el panel antes de que entre en vigor.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Para cualquier duda sobre estos términos, escríbenos desde el correo con el que
        creaste tu cuenta.
      </p>
      <p>
        Consulta también el{" "}
        <a href="/privacidad">aviso de privacidad</a> para saber qué datos tratamos y
        cómo ejercer tus derechos.
      </p>
    </LegalPage>
  );
}
