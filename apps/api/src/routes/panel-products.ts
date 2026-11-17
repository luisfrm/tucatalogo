/**
 * `/panel/products` (PLAN §8.2): CRUD, estado, reordenamiento e imágenes.
 * Todo se filtra por la tienda de la sesión, nunca por un id del cliente.
 */
import { Hono } from "hono";
import { z } from "zod";

import {
  mediaImageSchema,
  panelProductListSchema,
  panelProductSchema,
  panelProductsQuerySchema,
  productCreateSchema,
  productImageFormSchema,
  productImageOrderSchema,
  productImageUpdateSchema,
  productStatusSchema,
  productUpdateSchema,
  reorderSchema,
  resourceIdSchema,
} from "@tucatalogo/types";

import { MEDIA_LIMITS } from "../constants/catalog";
import { parseFormFields, readImageUpload, readMultipart, textFields } from "../libs/media";
import { parseJsonBody, parseParams, parseQuery } from "../libs/validate";
import { dbFor } from "../middleware/session";
import { sessionStore } from "../middleware/store-context";
import {
  addProductImage,
  createProduct,
  deletePanelImage,
  deletePanelProduct,
  getPanelProduct,
  listPanelProducts,
  reorderPanelImages,
  reorderStoreProducts,
  setPanelProductStatus,
  updatePanelImage,
  updateProduct,
} from "../services/product";
import type { AppEnv } from "../types";

const productParams = z.object({ id: resourceIdSchema });
const imageParams = z.object({ id: resourceIdSchema, imageId: resourceIdSchema });

export const panelProductsRoutes = new Hono<AppEnv>()
  /** GET /panel/products?q=&category=&status=&page= */
  .get("/", async (c) => {
    const query = parseQuery(c, panelProductsQuerySchema);
    const list = await listPanelProducts(c.env, dbFor(c), sessionStore(c), query);
    return c.json(panelProductListSchema.parse(list));
  })
  /** POST /panel/products */
  .post("/", async (c) => {
    const input = await parseJsonBody(c, productCreateSchema);
    const product = await createProduct(c.env, dbFor(c), sessionStore(c), input);
    return c.json(panelProductSchema.parse(product), 201);
  })
  /** PATCH /panel/products/reorder — antes que `/:id` para no colisionar. */
  .patch("/reorder", async (c) => {
    const input = await parseJsonBody(c, reorderSchema);
    await reorderStoreProducts(dbFor(c), sessionStore(c).id, input.ids);
    return c.body(null, 204);
  })
  /** GET /panel/products/:id */
  .get("/:id", async (c) => {
    const { id } = parseParams(c, productParams);
    const product = await getPanelProduct(c.env, dbFor(c), sessionStore(c), id);
    return c.json(panelProductSchema.parse(product));
  })
  /** PATCH /panel/products/:id */
  .patch("/:id", async (c) => {
    const { id } = parseParams(c, productParams);
    const input = await parseJsonBody(c, productUpdateSchema);
    const product = await updateProduct(c.env, dbFor(c), sessionStore(c), id, input);
    return c.json(panelProductSchema.parse(product));
  })
  /** DELETE /panel/products/:id — lógico (`is_deleted = 1`). */
  .delete("/:id", async (c) => {
    const { id } = parseParams(c, productParams);
    await deletePanelProduct(dbFor(c), sessionStore(c).id, id);
    return c.body(null, 204);
  })
  /** PATCH /panel/products/:id/status */
  .patch("/:id/status", async (c) => {
    const { id } = parseParams(c, productParams);
    const input = await parseJsonBody(c, productStatusSchema);
    const product = await setPanelProductStatus(
      c.env,
      dbFor(c),
      sessionStore(c),
      id,
      input.isActive,
    );
    return c.json(panelProductSchema.parse(product));
  })
  /** POST /panel/products/:id/images — multipart `full` + `thumb` + `alt`. */
  .post("/:id/images", async (c) => {
    const { id } = parseParams(c, productParams);
    const body = await readMultipart(c);
    const fields = parseFormFields(textFields(body), productImageFormSchema);

    const full = await readImageUpload(body.full, {
      field: "full",
      maxWidth: MEDIA_LIMITS.fullMaxWidth,
    });
    const thumb = await readImageUpload(body.thumb, {
      field: "thumb",
      maxWidth: MEDIA_LIMITS.thumbMaxWidth,
    });

    const image = await addProductImage(c.env, dbFor(c), sessionStore(c), id, {
      full,
      thumb,
      alt: fields.alt,
      declared: { width: fields.width, height: fields.height },
    });
    return c.json(mediaImageSchema.parse(image), 201);
  })
  /** PATCH /panel/products/:id/images/order — antes que `/:imageId`. */
  .patch("/:id/images/order", async (c) => {
    const { id } = parseParams(c, productParams);
    const input = await parseJsonBody(c, productImageOrderSchema);
    const product = await reorderPanelImages(c.env, dbFor(c), sessionStore(c), id, input.ids);
    return c.json(panelProductSchema.parse(product));
  })
  /** PATCH /panel/products/:id/images/:imageId — alt y orden. */
  .patch("/:id/images/:imageId", async (c) => {
    const { id, imageId } = parseParams(c, imageParams);
    const input = await parseJsonBody(c, productImageUpdateSchema);
    const image = await updatePanelImage(c.env, dbFor(c), sessionStore(c), id, imageId, input);
    return c.json(mediaImageSchema.parse(image));
  })
  /** DELETE /panel/products/:id/images/:imageId — fila + dos objetos de R2. */
  .delete("/:id/images/:imageId", async (c) => {
    const { id, imageId } = parseParams(c, imageParams);
    await deletePanelImage(c.env, dbFor(c), sessionStore(c), id, imageId);
    return c.body(null, 204);
  });
