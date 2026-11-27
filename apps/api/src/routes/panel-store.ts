/**
 * `/panel/store` (PLAN §8.2): datos de la tienda, logo, suspensión y borrado.
 * La tienda sale siempre de `requireStoreSession`; aquí no se lee del body.
 */
import { Hono } from "hono";
import type { Context } from "hono";

import {
  panelDeleteStoreSchema,
  panelStoreLogoResponseSchema,
  panelStoreSchema,
  panelStoreUpdateSchema,
  panelSuspendStoreSchema,
} from "@tucatalogo/types";

import { MEDIA_LIMITS } from "../constants/catalog";
import { getClientIp } from "../libs/ip";
import { readImageUpload, readMultipart } from "../libs/media";
import { parseJsonBody } from "../libs/validate";
import { dbFor } from "../middleware/session";
import { sessionOwner, sessionStore, sessionStoreId } from "../middleware/store-context";
import {
  deleteStoreByOwner,
  deleteStoreLogo,
  getPanelStore,
  reactivateStoreByOwner,
  suspendStoreByOwner,
  updatePanelStore,
  uploadStoreLogo,
} from "../services/store";
import type { AppEnv } from "../types";

function context(c: Context<AppEnv>) {
  return { store: sessionStore(c), owner: sessionOwner(c) };
}

export const panelStoreRoutes = new Hono<AppEnv>()
  /** GET /panel/store */
  .get("/", async (c) => {
    const store = await getPanelStore(c.env, dbFor(c), sessionStoreId(c));
    return c.json(panelStoreSchema.parse(store));
  })
  /** PATCH /panel/store — tema, color, modo, moneda y WhatsApp validados. */
  .patch("/", async (c) => {
    const input = await parseJsonBody(c, panelStoreUpdateSchema);
    const updated = await updatePanelStore(c.env, dbFor(c), context(c), input);
    return c.json(panelStoreSchema.parse(updated));
  })
  /** POST /panel/store/logo — multipart `logo` (WebP ≤ 2 MB, ≤ 1600 px). */
  .post("/logo", async (c) => {
    const body = await readMultipart(c);
    const upload = await readImageUpload(body.logo, {
      field: "logo",
      maxWidth: MEDIA_LIMITS.fullMaxWidth,
    });
    const result = await uploadStoreLogo(c.env, dbFor(c), context(c), upload);
    return c.json(panelStoreLogoResponseSchema.parse(result), 201);
  })
  /** DELETE /panel/store/logo — removes the logo from R2 and clears `logo_key`. */
  .delete("/logo", async (c) => {
    const store = await deleteStoreLogo(c.env, dbFor(c), context(c));
    return c.json(panelStoreSchema.parse(store));
  })
  /** POST /panel/store/suspend — `{reason?}`; suspensión del dueño. */
  .post("/suspend", async (c) => {
    const input = await parseJsonBody(c, panelSuspendStoreSchema);
    const store = await suspendStoreByOwner(c.env, dbFor(c), context(c), input.reason);
    return c.json(panelStoreSchema.parse(store));
  })
  /** POST /panel/store/reactivate — 403 si la suspensión fue del console. */
  .post("/reactivate", async (c) => {
    const store = await reactivateStoreByOwner(c.env, dbFor(c), context(c));
    return c.json(panelStoreSchema.parse(store));
  })
  /** DELETE /panel/store — `{password, confirmSlug}`; reautentica y borra. */
  .delete("/", async (c) => {
    const input = await parseJsonBody(c, panelDeleteStoreSchema);
    await deleteStoreByOwner(
      c.env,
      dbFor(c),
      context(c),
      input,
      c.req.raw,
      getClientIp(c.req.raw.headers),
    );
    return c.body(null, 204);
  });
