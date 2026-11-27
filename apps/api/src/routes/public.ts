/**
 * Rutas públicas consumidas **solo** por el worker `web` por service binding
 * (PLAN §8.2). Todas responden únicamente con una tienda `active`; el resto es
 * 404 sin distinguir motivo.
 */
import { Hono } from "hono";
import { z } from "zod";

import {
  publicCategoryListSchema,
  publicHeroSchema,
  publicProductDetailSchema,
  publicProductListSchema,
  publicProductsQuerySchema,
  publicSitemapSchema,
  publicStoreSchema,
} from "@tucatalogo/types";

import { parseParams, parseQuery } from "../libs/validate";
import { publicStore, requirePublicStore } from "../middleware/public-store";
import { dbFor } from "../middleware/session";
import { listPublicCategories } from "../services/category";
import { listPublicHero } from "../services/hero";
import { getPublicProduct, getPublicSitemap, listPublicProducts } from "../services/product";
import { toPublicStore } from "../services/store";
import type { AppEnv } from "../types";

export const publicRoutes = new Hono<AppEnv>()
  .use("/:slug/*", requirePublicStore)
  /** GET /public/:slug/store — tienda + tema + moneda + WhatsApp + logo. */
  .get("/:slug/store", (c) => {
    const data = toPublicStore(c.env, publicStore(c));
    return c.json(publicStoreSchema.parse(data));
  })
  /** GET /public/:slug/hero — slides activos ordenados. */
  .get("/:slug/hero", async (c) => {
    const hero = await listPublicHero(c.env, dbFor(c), publicStore(c));
    return c.json(publicHeroSchema.parse(hero));
  })
  /** GET /public/:slug/products?category=&q=&page= — solo activos y vivos. */
  .get("/:slug/products", async (c) => {
    const query = parseQuery(c, publicProductsQuerySchema);
    const list = await listPublicProducts(c.env, dbFor(c), publicStore(c), query);
    return c.json(publicProductListSchema.parse(list));
  })
  /** GET /public/:slug/products/:productSlug — ficha pública. */
  .get("/:slug/products/:productSlug", async (c) => {
    const params = parseParams(c, z.object({ productSlug: z.string().trim().min(1).max(63) }));
    const product = await getPublicProduct(c.env, dbFor(c), publicStore(c), params.productSlug);
    return c.json(publicProductDetailSchema.parse(product));
  })
  /** GET /public/:slug/categories — categorías ordenadas con conteo de activos. */
  .get("/:slug/categories", async (c) => {
    const categories = await listPublicCategories(dbFor(c), publicStore(c));
    return c.json(publicCategoryListSchema.parse(categories));
  })
  /** GET /public/:slug/sitemap — slugs y `updatedAt` para que `web` genere el XML. */
  .get("/:slug/sitemap", async (c) => {
    const sitemap = await getPublicSitemap(dbFor(c), publicStore(c));
    return c.json(publicSitemapSchema.parse(sitemap));
  });
