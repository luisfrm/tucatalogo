import { Link } from "react-router";

import { Button } from "@tucatalogo/ui";

import type { SignupResponse } from "@tucatalogo/types";

import { CopyButton } from "~/components/copy-button";
import { panelLoginPath } from "./slug";

export function DoneStep({ result }: { result: SignupResponse }) {
  const storefront = result.links.storefront;
  const panelLogin = panelLoginPath(result.links.panel);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-success">Tienda publicada</p>
        <h2 className="mt-1 font-heading text-2xl font-semibold text-text">
          {result.store.name} ya tiene su catálogo
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Tu cuenta y tu tienda están creadas. Comparte el enlace del catálogo y entra
          al panel para subir tu logo, tus categorías y tus productos.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
            Tu tienda
          </p>
          <a
            href={storefront}
            className="mt-1 block break-all text-sm font-medium text-primary underline underline-offset-4"
          >
            {storefront}
          </a>
          <div className="mt-3">
            <CopyButton value={storefront} label="Copiar enlace de la tienda" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
            Tu panel
          </p>
          <a
            href={panelLogin}
            className="mt-1 block break-all text-sm font-medium text-primary underline underline-offset-4"
          >
            {panelLogin}
          </a>
          <p className="mt-2 text-xs leading-relaxed text-text-muted">
            Entra con el email <span className="font-medium text-text">{result.user.email}</span>{" "}
            y la contraseña que acabas de crear. La sesión vive en el dominio de tu
            tienda, así que no la creamos desde aquí.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-2 p-4">
        <p className="text-sm font-semibold text-text">Primeros pasos en el panel</p>
        <ol className="mt-2 space-y-1.5 text-sm text-text-muted">
          <li>1. Añade el número de WhatsApp donde quieres recibir los pedidos.</li>
          <li>2. Crea tus categorías y sube los productos con sus precios.</li>
          <li>3. Elige tu portada y comparte el enlace en tus redes.</li>
        </ol>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <a href={panelLogin}>Ir a mi panel</a>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link to="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
