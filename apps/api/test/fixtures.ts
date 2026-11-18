/**
 * Fixtures de los tests de catálogo/panel/console.
 *
 * Todo corre contra D1 y R2 locales (sin red). Cada fichero de test tiene su
 * propio almacenamiento aislado, así que las fixtures crean sus tiendas.
 */
import { findLastEmailTo } from "../src/libs/email";
import { testEnv } from "./env";
import {
  api,
  cookiePair,
  extractOtp,
  postJson,
  totp,
  totpSecretFromUri,
  uniqueEmail,
  uniqueSlug,
} from "./helpers";

export const STORE_PASSWORD = "Contraseña123";
export const ADMIN_PASSWORD = "AdminContraseña1";

export interface StoreFixture {
  slug: string;
  storeId: string;
  email: string;
  password: string;
  cookie: string;
}

interface CreateStoreOptions {
  email?: string;
  slug?: string;
  currency?: string;
  themeId?: string;
  whatsappNumber?: string;
}

/** Registro + login de tienda: devuelve slug, id y cookie de sesión. */
export async function createStore(options: CreateStoreOptions = {}): Promise<StoreFixture> {
  const email = options.email ?? uniqueEmail();
  const slug = options.slug ?? uniqueSlug();

  const otp = await postJson("/auth/store/signup/otp", {
    email,
    slug,
    turnstileToken: "test-token",
  });
  if (otp.status !== 202) throw new Error(`OTP falló: ${otp.status} ${await otp.text()}`);

  const message = findLastEmailTo(email);
  if (!message) throw new Error("No se envió el OTP");
  const code = extractOtp(message.text);

  const signup = await postJson("/auth/store/signup", {
    name: "Dueña Ejemplo",
    email,
    password: STORE_PASSWORD,
    storeName: "Tienda Ejemplo",
    slug,
    currency: options.currency ?? "USD",
    themeId: options.themeId ?? "rose",
    ...(options.whatsappNumber ? { whatsappNumber: options.whatsappNumber } : {}),
    code,
  });
  if (signup.status !== 201) throw new Error(`signup falló: ${signup.status} ${await signup.text()}`);

  const body = (await signup.json()) as { store: { id: string } };

  const login = await postJson(
    "/auth/store/login",
    { email, password: STORE_PASSWORD },
    { "x-store-slug": slug },
  );
  if (login.status !== 200) throw new Error(`login falló: ${login.status} ${await login.text()}`);

  return {
    slug,
    storeId: body.store.id,
    email,
    password: STORE_PASSWORD,
    cookie: cookiePair(login, "store.session_token"),
  };
}

export interface AdminFixture {
  email: string;
  password: string;
  cookie: string;
  adminId: string;
}

/**
 * Limpia el reino console (`/init` es one-time por base). Cada fichero de test
 * tiene su propio D1 aislado; esto solo ordena los casos dentro del fichero.
 */
export async function resetAdminRealm(): Promise<void> {
  await testEnv.DB.batch([
    testEnv.DB.prepare("DELETE FROM admin_two_factor"),
    testEnv.DB.prepare("DELETE FROM admin_sessions"),
    testEnv.DB.prepare("DELETE FROM admin_accounts"),
    testEnv.DB.prepare("DELETE FROM admin_verifications"),
    testEnv.DB.prepare("DELETE FROM admin_users"),
    testEnv.DB.prepare("DELETE FROM audit_log"),
  ]);
}

/** `/init` + enrolamiento TOTP: cookie de console con 2FA verificado. */
export async function createAdminSession(): Promise<AdminFixture> {
  const email = uniqueEmail("admin");
  const init = await postJson("/auth/console/init", {
    name: "Admin",
    email,
    password: ADMIN_PASSWORD,
  });
  if (init.status !== 201) throw new Error(`init falló: ${init.status} ${await init.text()}`);

  // M1: `/init` no emite sesión; devuelve un challenge de enrolamiento.
  const body = (await init.json()) as {
    totpUri: string;
    admin: { id: string };
    enrollmentToken: string;
  };

  const verify = await postJson("/auth/console/2fa/verify", {
    code: await totp(totpSecretFromUri(body.totpUri)),
    enrollmentToken: body.enrollmentToken,
  });
  if (verify.status !== 204) throw new Error(`2fa falló: ${verify.status} ${await verify.text()}`);

  return {
    email,
    password: ADMIN_PASSWORD,
    cookie: cookiePair(verify, "console.session_token"),
    adminId: body.admin.id,
  };
}

/** Petición JSON al panel con la sesión y el slug de la tienda. */
export function panelRequest(
  fixture: StoreFixture,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {
    cookie: fixture.cookie,
    "x-store-slug": fixture.slug,
  };
  if (body !== undefined) headers["content-type"] = "application/json";

  return api(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** POST multipart al panel (imágenes). */
export function panelMultipart(
  fixture: StoreFixture,
  path: string,
  form: FormData,
): Promise<Response> {
  return api(path, {
    method: "POST",
    headers: { cookie: fixture.cookie, "x-store-slug": fixture.slug },
    body: form,
  });
}

/** Petición JSON al console con la cookie de admin. */
export function consoleRequest(
  admin: AdminFixture,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = { cookie: admin.cookie };
  if (body !== undefined) headers["content-type"] = "application/json";

  return api(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
