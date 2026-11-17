/**
 * `/panel/hero` (PLAN §6.9 / §8.2).
 *
 * Crear un slide exige las dos imágenes en el mismo multipart (la tabla no
 * admite keys vacías); `POST /:id/images` reemplaza las variantes.
 */
import { Hono } from "hono";
import { z } from "zod";

import {
  heroFormSchema,
  heroReorderSchema,
  heroUpdateSchema,
  panelHeroListSchema,
  panelHeroSlideSchema,
  resourceIdSchema,
} from "@tucatalogo/types";

import { MEDIA_LIMITS } from "../constants/catalog";
import { parseFormFields, readImageUpload, readMultipart, textFields } from "../libs/media";
import { parseJsonBody, parseParams } from "../libs/validate";
import { dbFor } from "../middleware/session";
import { sessionStore } from "../middleware/store-context";
import {
  createHeroSlide,
  deletePanelHero,
  listPanelHero,
  replaceHeroImages,
  reorderPanelHero,
  updatePanelHero,
} from "../services/hero";
import type { AppEnv } from "../types";

const slideParams = z.object({ id: resourceIdSchema });

/** `isActive` viaja como texto en multipart; sin valor, el slide nace visible. */
function parseIsActive(value: string | undefined): boolean {
  if (value === undefined) return true;
  return value === "true" || value === "1";
}

export const panelHeroRoutes = new Hono<AppEnv>()
  /** GET /panel/hero — todos los slides (activos e inactivos) + tope. */
  .get("/", async (c) => {
    const list = await listPanelHero(c.env, dbFor(c), sessionStore(c));
    return c.json(panelHeroListSchema.parse(list));
  })
  /** POST /panel/hero — multipart `desktop` + `mobile` + textos. */
  .post("/", async (c) => {
    const body = await readMultipart(c);
    const fields = parseFormFields(textFields(body), heroFormSchema);

    const desktop = await readImageUpload(body.desktop, {
      field: "desktop",
      maxWidth: MEDIA_LIMITS.heroMaxWidth,
    });
    const mobile = await readImageUpload(body.mobile, {
      field: "mobile",
      maxWidth: MEDIA_LIMITS.heroMaxWidth,
    });

    const slide = await createHeroSlide(c.env, dbFor(c), sessionStore(c), {
      desktop,
      mobile,
      title: fields.title,
      subtitle: fields.subtitle,
      ctaLabel: fields.ctaLabel,
      ctaUrl: fields.ctaUrl,
      isActive: parseIsActive(fields.isActive),
      sortOrder: fields.sortOrder,
    });
    return c.json(panelHeroSlideSchema.parse(slide), 201);
  })
  /** PATCH /panel/hero/reorder — antes que `/:id`. */
  .patch("/reorder", async (c) => {
    const input = await parseJsonBody(c, heroReorderSchema);
    const list = await reorderPanelHero(c.env, dbFor(c), sessionStore(c), input.ids);
    return c.json(panelHeroListSchema.parse(list));
  })
  /** PATCH /panel/hero/:id — textos, CTA, visibilidad y orden. */
  .patch("/:id", async (c) => {
    const { id } = parseParams(c, slideParams);
    const input = await parseJsonBody(c, heroUpdateSchema);
    const slide = await updatePanelHero(c.env, dbFor(c), sessionStore(c), id, input);
    return c.json(panelHeroSlideSchema.parse(slide));
  })
  /** DELETE /panel/hero/:id — fila + los dos objetos de R2. */
  .delete("/:id", async (c) => {
    const { id } = parseParams(c, slideParams);
    await deletePanelHero(c.env, dbFor(c), sessionStore(c), id);
    return c.body(null, 204);
  })
  /** POST /panel/hero/:id/images — reemplaza `desktop` + `mobile`. */
  .post("/:id/images", async (c) => {
    const { id } = parseParams(c, slideParams);
    const body = await readMultipart(c);

    const desktop = await readImageUpload(body.desktop, {
      field: "desktop",
      maxWidth: MEDIA_LIMITS.heroMaxWidth,
    });
    const mobile = await readImageUpload(body.mobile, {
      field: "mobile",
      maxWidth: MEDIA_LIMITS.heroMaxWidth,
    });

    const slide = await replaceHeroImages(c.env, dbFor(c), sessionStore(c), id, {
      desktop,
      mobile,
    });
    return c.json(panelHeroSlideSchema.parse(slide));
  });
