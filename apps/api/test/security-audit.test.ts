import { describe, expect, it } from "vitest";

import { testEnv } from "./env";
import { createStore, panelRequest, readJson } from "./fixtures";
import { api } from "./helpers";

async function ownerIdOf(storeId: string): Promise<string> {
  const row = await testEnv.DB.prepare("SELECT owner_id FROM store WHERE id = ?")
    .bind(storeId)
    .first<{ owner_id: string }>();
  return row!.owner_id;
}

describe("M3 — audit de suspender/reactivar del dueño", () => {
  it("escribe audit_log con actor owner, motivo y source del panel", async () => {
    const fixture = await createStore();
    const ownerId = await ownerIdOf(fixture.storeId);

    const suspend = await panelRequest(fixture, "POST", "/panel/store/suspend", {
      reason: "Vacaciones",
    });
    expect(suspend.status).toBe(200);

    const suspendAudit = await testEnv.DB.prepare(
      "SELECT actor_type, actor_id, store_slug, action, target_type, target_id, metadata FROM audit_log WHERE store_id = ? AND action = 'store.suspend'",
    )
      .bind(fixture.storeId)
      .first<{
        actor_type: string;
        actor_id: string;
        store_slug: string;
        action: string;
        target_type: string;
        target_id: string;
        metadata: string;
      }>();

    expect(suspendAudit).toMatchObject({
      actor_type: "owner",
      actor_id: ownerId,
      store_slug: fixture.slug,
      action: "store.suspend",
      target_type: "store",
      target_id: fixture.storeId,
    });
    expect(JSON.parse(suspendAudit!.metadata)).toMatchObject({
      reason: "Vacaciones",
      source: "panel",
    });

    const reactivate = await panelRequest(fixture, "POST", "/panel/store/reactivate");
    expect(reactivate.status).toBe(200);

    const reactivateAudit = await testEnv.DB.prepare(
      "SELECT actor_type, actor_id, action, metadata FROM audit_log WHERE store_id = ? AND action = 'store.reactivate'",
    )
      .bind(fixture.storeId)
      .first<{ actor_type: string; actor_id: string; action: string; metadata: string }>();

    expect(reactivateAudit).toMatchObject({
      actor_type: "owner",
      actor_id: ownerId,
      action: "store.reactivate",
    });
    expect(JSON.parse(reactivateAudit!.metadata)).toMatchObject({ source: "panel" });
  });

  it("una suspensión rechazada por ser administrativa no escribe audit de dueño", async () => {
    const fixture = await createStore();
    await testEnv.DB.prepare(
      "UPDATE store SET status = 'suspended', suspended_by = 'admin', suspended_reason = 'Abuso', suspended_at = ? WHERE id = ?",
    )
      .bind(Date.now(), fixture.storeId)
      .run();

    const response = await panelRequest(fixture, "POST", "/panel/store/suspend", {
      reason: "Intento",
    });
    expect(response.status).toBe(403);

    const count = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM audit_log WHERE store_id = ? AND action = 'store.suspend'",
    )
      .bind(fixture.storeId)
      .first<{ total: number }>();
    expect(count?.total).toBe(0);
  });
});

describe("B7 — requestId generado por el servidor", () => {
  it("ignora x-request-id y cf-ray y devuelve un UUID propio", async () => {
    const response = await api("/health", {
      headers: {
        "x-request-id": "atacante-123",
        "cf-ray": "8f0d1b2c3d4e5f60-MAD",
      },
    });
    expect(response.status).toBe(200);

    const requestId = response.headers.get("x-request-id");
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(requestId).not.toBe("atacante-123");
    expect(requestId).not.toBe("8f0d1b2c3d4e5f60-MAD");

    const second = await api("/health");
    expect(second.headers.get("x-request-id")).not.toBe(requestId);
  });

  it("el envelope de error usa el mismo id del servidor, no la cabecera del cliente", async () => {
    const response = await api("/ruta-inexistente", {
      headers: { "x-request-id": "atacante-456" },
    });
    expect(response.status).toBe(404);

    const body = await readJson<{ error: { requestId: string } }>(response);
    expect(body.error.requestId).toBe(response.headers.get("x-request-id"));
    expect(body.error.requestId).not.toBe("atacante-456");
  });
});

describe("B8 — verifications del dueño en el hard delete", () => {
  it("borra tokens del dueño (por value e identifier) y expirados, sin tocar los de otros", async () => {
    const fixture = await createStore();
    const ownerId = await ownerIdOf(fixture.storeId);
    const now = Date.now();

    const insert = testEnv.DB.prepare(
      "INSERT INTO store_verifications (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    );

    await testEnv.DB.batch([
      // Reset del dueño: Better Auth guarda `reset-password:<token>` → value=userId.
      insert.bind(
        crypto.randomUUID(),
        "reset-password:token-del-dueno",
        ownerId,
        now + 30 * 60 * 1000,
        now,
        now,
      ),
      // Verificación de email: el email va en el identificador.
      insert.bind(
        crypto.randomUUID(),
        `verificar:${fixture.email}`,
        "codigo-otro-valor",
        now + 30 * 60 * 1000,
        now,
        now,
      ),
      // Mismo email en mayúsculas: la limpieza no distingue caja.
      insert.bind(
        crypto.randomUUID(),
        `VERIFICAR:${fixture.email.toUpperCase()}`,
        "codigo",
        now + 30 * 60 * 1000,
        now,
        now,
      ),
      // Otro usuario, vigente: debe sobrevivir.
      insert.bind(
        crypto.randomUUID(),
        "reset-password:token-ajeno",
        "otro-user-id",
        now + 30 * 60 * 1000,
        now,
        now,
      ),
      // Expirado: se purga aunque no sea del dueño.
      insert.bind(
        crypto.randomUUID(),
        "reset-password:token-expirado",
        "otro-user-id-2",
        now - 60_000,
        now,
        now,
      ),
    ]);

    const deleted = await panelRequest(fixture, "DELETE", "/panel/store", {
      password: fixture.password,
      confirmSlug: fixture.slug,
    });
    expect(deleted.status).toBe(204);

    const leftovers = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM store_verifications WHERE lower(identifier) LIKE ? OR value = ?",
    )
      .bind(`%${fixture.email.toLowerCase()}%`, ownerId)
      .first<{ total: number }>();
    expect(leftovers?.total).toBe(0);

    const remaining = await testEnv.DB.prepare(
      "SELECT identifier FROM store_verifications ORDER BY identifier",
    ).all<{ identifier: string }>();
    expect(remaining.results.map((row) => row.identifier)).toEqual([
      "reset-password:token-ajeno",
    ]);
    expect(JSON.stringify(remaining.results)).not.toContain(fixture.email);
    expect(JSON.stringify(remaining.results)).not.toContain(ownerId);
  });
});

describe("B4 — rate limit de DELETE /panel/store", () => {
  it("bloquea con 429 y Retry-After tras 5 intentos, incluso con la contraseña correcta", async () => {
    const fixture = await createStore();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await panelRequest(fixture, "DELETE", "/panel/store", {
        password: "MalaContraseña1",
        confirmSlug: fixture.slug,
      });
      expect(response.status).toBe(401);
    }

    const blocked = await panelRequest(fixture, "DELETE", "/panel/store", {
      password: fixture.password,
      confirmSlug: fixture.slug,
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(await readJson(blocked)).toMatchObject({
      error: { code: "RATE_LIMITED", reason: "RATE_LIMITED" },
    });

    const alive = await testEnv.DB.prepare("SELECT COUNT(*) AS total FROM store WHERE id = ?")
      .bind(fixture.storeId)
      .first<{ total: number }>();
    expect(alive?.total).toBe(1);
  });

  it("el cupo es por tienda: otra tienda no hereda el bloqueo", async () => {
    const blockedStore = await createStore();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await panelRequest(blockedStore, "DELETE", "/panel/store", {
        password: "MalaContraseña1",
        confirmSlug: blockedStore.slug,
      });
    }
    expect(
      (
        await panelRequest(blockedStore, "DELETE", "/panel/store", {
          password: blockedStore.password,
          confirmSlug: blockedStore.slug,
        })
      ).status,
    ).toBe(429);

    const other = await createStore();
    const otherAttempt = await panelRequest(other, "DELETE", "/panel/store", {
      password: "MalaContraseña1",
      confirmSlug: other.slug,
    });
    expect(otherAttempt.status).toBe(401);
  });
});
