import { useEffect } from "react";

/**
 * Fuentes de los 5 temas, cargadas **solo cuando la sección se acerca**.
 *
 * Las previews de `#temas` son honestas: cada una pinta los tokens reales de su
 * tema, incluida su familia tipográfica. Esas 7 familias (Cormorant Garamond,
 * Inter, Playfair Display, Montserrat, Fredoka, Nunito y Outfit) no forman
 * parte de la identidad above-the-fold y suman ~257 KiB de woff2, así que su
 * `@font-face` (resource route `/theme-fonts.css`) se pide con 800 px de
 * antelación: 0 bytes antes del scroll y fuera de la ventana de LCP.
 *
 * Sin JS o sin `IntersectionObserver` se pide al montar: nunca se muestran
 * previews con la serif del sistema por haber fallado la carga.
 */
const THEME_FONTS_HREF = "/theme-fonts.css";
const SELECTOR = "link[data-theme-fonts]";

function requestThemeFonts() {
  if (document.querySelector(SELECTOR)) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = THEME_FONTS_HREF;
  link.setAttribute("data-theme-fonts", "");
  document.head.appendChild(link);
}

export function ThemeFontLoader({ target = "#temas" }: { target?: string }) {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      requestThemeFonts();
      return;
    }

    const section = document.querySelector(target);
    if (!section) {
      requestThemeFonts();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        requestThemeFonts();
      },
      { rootMargin: "800px 0px 0px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [target]);

  return null;
}
