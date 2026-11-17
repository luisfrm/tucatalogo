import type { MetaDescriptor } from "react-router";

/**
 * SEO por tienda y producto (PLAN §15.1): título, descripción, canonical,
 * Open Graph y `robots`. El `canonical` siempre apunta al subdominio de la
 * tienda en producción; en local/dev la página sale con `noindex`.
 */
export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  noindex: boolean;
  siteName: string;
  type?: "website" | "product";
  image?: string | null;
  structuredData?: Record<string, unknown> | null;
}

export const SEO_DESCRIPTION_MAX = 160;

export function truncateText(text: string, max = SEO_DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function seoDescriptors(seo: PageSeo): MetaDescriptor[] {
  const type = seo.type ?? "website";
  const descriptors: MetaDescriptor[] = [
    { title: seo.title },
    { name: "description", content: seo.description },
    {
      name: "robots",
      content: seo.noindex ? "noindex, nofollow" : "index, follow",
    },
    { property: "og:type", content: type },
    { property: "og:title", content: seo.title },
    { property: "og:description", content: seo.description },
    { property: "og:url", content: seo.canonical },
    { property: "og:site_name", content: seo.siteName },
    { property: "og:locale", content: "es_ES" },
    {
      name: "twitter:card",
      content: seo.image ? "summary_large_image" : "summary",
    },
    { name: "twitter:title", content: seo.title },
    { name: "twitter:description", content: seo.description },
    { tagName: "link", rel: "canonical", href: seo.canonical },
  ];

  if (seo.image) {
    descriptors.push(
      { property: "og:image", content: seo.image },
      { name: "twitter:image", content: seo.image },
    );
  }

  if (seo.structuredData) {
    descriptors.push({ "script:ld+json": seo.structuredData });
  }

  return descriptors;
}

/** Escapa texto para XML (`sitemap.xml`). */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
