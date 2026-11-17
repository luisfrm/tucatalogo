import crypto from "node:crypto";

/**
 * TOTP (RFC 6238) para el 2FA del console: base32 + HMAC-SHA1 + 6 dígitos.
 * Existe solo aquí, en los tests: el producto no genera códigos.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Carácter base32 inválido: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function totpCode(secret: string, atMs = Date.now(), stepSeconds = 30, digits = 6): string {
  const key = base32Decode(secret);
  const counter = Math.floor(atMs / 1000 / stepSeconds);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** Extrae el `secret` de una URI `otpauth://totp/...`. */
export function secretFromTotpUri(uri: string): string {
  const parsed = new URL(uri);
  const secret = parsed.searchParams.get("secret");
  if (!secret) throw new Error(`La URI TOTP no trae secret: ${uri}`);
  return secret;
}

/** Código válido ahora, evitando justo el borde del intervalo de 30 s. */
export function currentTotp(secret: string): string {
  const now = Date.now();
  const intoWindow = now % 30_000;
  // Un margen de 2 s evita cruzar el límite entre generar y enviar el código.
  const safe = intoWindow > 28_000 ? now + 2_000 : intoWindow < 1_000 ? now - 1_000 : now;
  return totpCode(secret, safe);
}
