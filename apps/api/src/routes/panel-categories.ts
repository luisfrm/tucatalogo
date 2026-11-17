/**
 * `/panel/categories` (PLAN §8.2). `slug` único por tienda; borrar deja los
 * productos con `category_id = NULL`.
 */
import { Hono } from "hono";
import { z } from "zod";

import {
  categoryCreateSchema,
  categoryUpdateSchema,
  panelCategoryListSchema,
  panelCategorySchema,
  resourceIdSchema,
} from "@tucatalogo/types";

import { parseJsonBody, parseParams } from "../libs/validate";
import { dbFor } from "../middleware/session";
import { sessionStore } from "../middleware/store-context";
import {
  createCategory,
  deletePanelCategory,
  listPanelCategories,
  updatePanelCategory,
} from "../services/category";
import type { AppEnv } from "../types";

const categoryParams = z.object({ id: resourceIdSchema });

export const panelCategoriesRoutes = new Hono<AppEnv>()
  /** GET /panel/categories */
  .get("/", async (c) => {
    const list = await listPanelCategories(dbFor(c), sessionStore(c).id);
    return c.json(panelCategoryListSchema.parse(list));
  })
  /** POST /panel/categories */
  .post("/", async (c) => {
    const input = await parseJsonBody(c, categoryCreateSchema);
    const category = await createCategory(dbFor(c), sessionStore(c), input);
    return c.json(panelCategorySchema.parse(category), 201);
  })
  /** PATCH /panel/categories/:id */
  .patch("/:id", async (c) => {
    const { id } = parseParams(c, categoryParams);
    const input = await parseJsonBody(c, categoryUpdateSchema);
    const category = await updatePanelCategory(dbFor(c), sessionStore(c), id, input);
    return c.json(panelCategorySchema.parse(category));
  })
  /** DELETE /panel/categories/:id — los productos quedan sin categoría. */
  .delete("/:id", async (c) => {
    const { id } = parseParams(c, categoryParams);
    await deletePanelCategory(dbFor(c), sessionStore(c).id, id);
    return c.body(null, 204);
  });
