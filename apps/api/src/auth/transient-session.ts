/**
 * Sesión transitoria del reino console (M1).
 *
 * El hallazgo M1 es que `/init`, `/2fa/setup` y `/auth/console/login` emitían
 * una **cookie de sesión** antes de verificar el segundo factor. La cookie solo
 * debe salir de `/auth/console/2fa/verify`, después de un TOTP/backup correcto.
 *
 * Para que la verificación del enrolamiento siga ocurriendo dentro de Better
 * Auth (que es quien conoce el secreto TOTP y rota la sesión al marcarla como
 * verificada), el API crea aquí una sesión **de servidor** que nunca viaja al
 * cliente:
 *
 * 1. `createTransientConsoleSession` inserta la fila en `admin_sessions` y
 *    devuelve el `Cookie` interno firmado con el secreto del reino.
 * 2. Se llama a `auth.api.verifyTOTP`/`verifyBackupCode` con esa cookie.
 * 3. Better Auth verifica el código, marca `verified = 1`, crea **otra**
 *    sesión, fija su cookie y borra la transitoria. El `Set-Cookie` de esa
 *    respuesta es el único que se reenvía al navegador.
 *
 * Si la verificación falla, el service borra la sesión transitoria: no queda
 * ninguna sesión viva de un intento fallido.
 */
import { makeSignature } from "better-auth/crypto";

import type { ConsoleAuth } from "./console";

export interface TransientConsoleSession {
  /** Valor listo para la cabecera `Cookie` de una llamada interna. */
  cookieHeader: string;
  /** Token de la fila creada, para poder revocarla si falla el 2FA. */
  token: string;
}

/**
 * Crea una sesión de servidor (nunca se entrega al cliente) y firma su cookie
 * igual que el plugin de sesiones de Better Auth (`token.HMAC-SHA256(token)`).
 */
export async function createTransientConsoleSession(
  auth: ConsoleAuth,
  options: { userId: string; ip?: string; userAgent?: string },
): Promise<TransientConsoleSession> {
  const context = await auth.$context;
  const session = await context.internalAdapter.createSession(options.userId, false, {
    ipAddress: options.ip ?? "",
    userAgent: options.userAgent ?? "",
  });

  const signature = await makeSignature(session.token, context.secret);
  const value = encodeURIComponent(`${session.token}.${signature}`);

  return {
    cookieHeader: `${context.authCookies.sessionToken.name}=${value}`,
    token: session.token,
  };
}
