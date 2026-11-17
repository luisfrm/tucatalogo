import { Button } from "@tucatalogo/ui";
import type { PublicHeroSlide } from "@tucatalogo/types";
import { useState } from "react";
import { Link } from "react-router";

import { storeHref } from "~/lib/urls";

/**
 * Hero del storefront (PLAN §4.5 D / §9.6).
 *
 * - `<picture>` con variante mobile y desktop del mismo slide.
 * - Sin autoplay; controles con teclado (flechas) además de los botones.
 * - El texto va debajo de la imagen para garantizar contraste AA.
 * - El primer slide es el único sin `loading="lazy"`.
 */
export interface HeroCarouselProps {
  slides: PublicHeroSlide[];
  siteId: string | null;
}

function ctaHref(slide: PublicHeroSlide, siteId: string | null): string | null {
  if (!slide.ctaUrl || !slide.ctaLabel) return null;
  if (slide.ctaUrl.startsWith("https://")) return slide.ctaUrl;
  return storeHref(slide.ctaUrl, { siteId });
}

function HeroCta({ href, label }: { href: string; label: string }) {
  const external = !href.startsWith("/");

  return (
    <Button asChild variant="primary" size="md" className="mt-1 self-start">
      {external ? (
        <a href={href} rel="noopener noreferrer">
          {label}
        </a>
      ) : (
        <Link to={href}>{label}</Link>
      )}
    </Button>
  );
}

function HeroImage({ slide, priority }: { slide: PublicHeroSlide; priority: boolean }) {
  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={slide.desktopUrl} />
      <img
        src={slide.mobileUrl}
        alt={slide.title ?? slide.subtitle ?? "Imagen destacada de la tienda"}
        width={1200}
        height={1500}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className="h-full w-full object-cover"
      />
    </picture>
  );
}

export function HeroCarousel({ slides, siteId }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const total = slides.length;

  if (total === 0) return null;

  const current = slides[Math.min(index, total - 1)];
  const currentHref = ctaHref(current, siteId);

  if (total === 1) {
    return (
      <section aria-label="Destacado de la tienda" className="overflow-hidden rounded-lg border-[length:var(--border-width)] border-border bg-surface shadow-sm">
        <div className="aspect-[4/5] w-full overflow-hidden bg-surface-2 sm:aspect-[16/7]">
          <HeroImage slide={current} priority />
        </div>
        {current.title || current.subtitle || currentHref ? (
          <div className="flex flex-col gap-2 p-4 sm:p-5">
            {current.title ? <h2 className="font-heading text-xl font-semibold sm:text-2xl">{current.title}</h2> : null}
            {current.subtitle ? <p className="text-sm text-text-muted">{current.subtitle}</p> : null}
            {currentHref ? <HeroCta href={currentHref} label={current.ctaLabel ?? "Ver más"} /> : null}
          </div>
        ) : null}
      </section>
    );
  }

  const go = (delta: number) => {
    setIndex((value) => (value + delta + total) % total);
  };

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Destacados de la tienda"
      className="overflow-hidden rounded-lg border-[length:var(--border-width)] border-border bg-surface shadow-sm"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          go(1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(-1);
        }
      }}
    >
      <div className="relative">
        {slides.map((slide, slideIndex) => {
          const active = slideIndex === index;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${slideIndex + 1} de ${total}`}
              hidden={!active}
              className="aspect-[4/5] w-full overflow-hidden bg-surface-2 sm:aspect-[16/7]"
            >
              <HeroImage slide={slide} priority={slideIndex === 0} />
            </div>
          );
        })}

        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between p-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Diapositiva anterior"
            onClick={() => go(-1)}
            className="pointer-events-auto bg-surface/90"
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Diapositiva siguiente"
            onClick={() => go(1)}
            className="pointer-events-auto bg-surface/90"
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div className="min-w-0">
          {current.title ? (
            <h2 className="font-heading text-xl font-semibold leading-snug sm:text-2xl">{current.title}</h2>
          ) : null}
          {current.subtitle ? <p className="mt-1 text-sm text-text-muted">{current.subtitle}</p> : null}
          {currentHref ? <HeroCta href={currentHref} label={current.ctaLabel ?? "Ver más"} /> : null}
        </div>

        <div role="group" aria-label="Seleccionar diapositiva" className="flex shrink-0 items-center gap-0.5">
          {slides.map((slide, slideIndex) => {
            const active = slideIndex === index;
            return (
              <button
                key={slide.id}
                type="button"
                aria-label={`Ir a la diapositiva ${slideIndex + 1}`}
                aria-current={active ? "true" : undefined}
                onClick={() => setIndex(slideIndex)}
                className="flex size-9 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              >
                <span
                  aria-hidden="true"
                  className={
                    active
                      ? "block size-3 rounded-full border-[length:var(--border-width)] border-primary bg-primary"
                      : "block size-3 rounded-full border-[length:var(--border-width)] border-border-strong bg-surface"
                  }
                />
              </button>
            );
          })}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Diapositiva {index + 1} de {total}
      </p>
    </section>
  );
}
