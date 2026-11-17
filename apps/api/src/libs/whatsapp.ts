/**
 * Enlace de pedido por WhatsApp (PLAN §6.5 / §8.2).
 *
 * La plantilla es del dueño y admite `{producto}`, `{precio}` y `{tienda}`.
 * Sin número configurado no hay botón (`null`, estado previsto). Sin plantilla
 * el enlace se abre sin texto: nunca se inventa un mensaje por defecto.
 */
export interface WhatsappOrderInput {
  number: string | null;
  template: string | null;
  storeName: string;
  productName: string;
  priceLabel: string;
}

export function renderWhatsappTemplate(
  template: string,
  values: { storeName: string; productName: string; priceLabel: string },
): string {
  return template
    .replaceAll("{producto}", values.productName)
    .replaceAll("{precio}", values.priceLabel)
    .replaceAll("{tienda}", values.storeName)
    .trim();
}

export function buildWhatsappUrl(input: WhatsappOrderInput): string | null {
  const number = input.number?.replace(/\D/g, "") ?? "";
  if (!number) return null;

  const text = input.template
    ? renderWhatsappTemplate(input.template, {
        storeName: input.storeName,
        productName: input.productName,
        priceLabel: input.priceLabel,
      })
    : "";

  const base = `https://wa.me/${number}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
