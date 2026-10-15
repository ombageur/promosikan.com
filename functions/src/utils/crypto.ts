import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Enkripsi token OAuth (AES-256-GCM). Kunci 32 byte (base64) dari Secret Manager
 * (TOKEN_ENCRYPTION_KEY). Ciphertext tidak berguna tanpa kunci; tag GCM mencegah manipulasi.
 */
export type Encrypted = { v: 1; iv: string; tag: string; data: string };

function keyFrom(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY harus 32 byte (base64).");
  return key;
}

export function encryptSecret(plain: string, base64Key: string): Encrypted {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(base64Key), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function decryptSecret(encrypted: Encrypted, base64Key: string): string {
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(base64Key), Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted.data, "base64")), decipher.final()]).toString("utf8");
}
