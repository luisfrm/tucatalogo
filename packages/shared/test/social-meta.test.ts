import { describe, expect, it } from "vitest";

import {
  absoluteUrl,
  socialMetaDescriptors,
  type SocialMeta,
} from "../src/libs/social-meta";

const BASE: SocialMeta = {
  title: "TuCatálogo · Tu catálogo con pedidos por WhatsApp",
  description: "Catálogo propio, cinco temas y pedidos por WhatsApp.",
  url: "https://tucatalogo.live/",
  siteName: "TuCatálogo",
  image: {
    url: "https://tucatalogo.live/og.png",
    width: 1200,
    height: 630,
    alt: "TuCatálogo",
  },
};

function read(descriptors: ReturnType<typeof socialMetaDescriptors>) {
  return Object.fromEntries(
    descriptors.flatMap((descriptor) =>
      "property" in descriptor
        ? [[descriptor.property, descriptor.content]]
        : "name" in descriptor
          ? [[descriptor.name, descriptor.content]]
          : [],
    ),
  );
}

describe("socialMetaDescriptors", () => {
  it("emite un juego completo de Open Graph y Twitter con URL absoluta", () => {
    const tags = read(socialMetaDescriptors(BASE));

    expect(tags["og:title"]).toBe(BASE.title);
    expect(tags["og:description"]).toBe(BASE.description);
    expect(tags["og:url"]).toBe("https://tucatalogo.live/");
    expect(tags["og:image"]).toBe("https://tucatalogo.live/og.png");
    expect(tags["og:image:width"]).toBe("1200");
    expect(tags["og:image:height"]).toBe("630");
    expect(tags["og:image:type"]).toBe("image/png");
    expect(tags["og:image:alt"]).toBe("TuCatálogo");
    expect(tags["og:site_name"]).toBe("TuCatálogo");
    expect(tags["og:locale"]).toBe("es_ES");
    expect(tags["og:type"]).toBe("website");
    expect(tags["twitter:card"]).toBe("summary_large_image");
    expect(tags["twitter:image"]).toBe("https://tucatalogo.live/og.png");
  });

  it("no repite etiquetas (React Router solo pinta el meta de la ruta hoja)", () => {
    const keys = socialMetaDescriptors(BASE).flatMap((descriptor) =>
      "property" in descriptor
        ? [descriptor.property]
        : "name" in descriptor
          ? [descriptor.name]
          : ["title"],
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("añade `robots` solo cuando se pide (console)", () => {
    expect(socialMetaDescriptors(BASE).some((d) => "name" in d && d.name === "robots")).toBe(
      false,
    );

    const tags = read(
      socialMetaDescriptors({ ...BASE, robots: "noindex, nofollow" }),
    );
    expect(tags.robots).toBe("noindex, nofollow");
  });

  it("falla si la imagen no es una URL absoluta https (nada de rutas relativas)", () => {
    expect(() =>
      socialMetaDescriptors({
        ...BASE,
        image: { ...BASE.image, url: "/og.png" },
      }),
    ).toThrow(/absoluta/);

    expect(() =>
      socialMetaDescriptors({ ...BASE, url: "http://tucatalogo.live/" }),
    ).toThrow(/https/);
  });
});

describe("absoluteUrl", () => {
  it("compone https con la barra correcta", () => {
    expect(absoluteUrl("tucatalogo.live")).toBe("https://tucatalogo.live/");
    expect(absoluteUrl("tucatalogo.live", "og.png")).toBe(
      "https://tucatalogo.live/og.png",
    );
    expect(absoluteUrl("console.tucatalogo.live", "/login")).toBe(
      "https://console.tucatalogo.live/login",
    );
  });
});
