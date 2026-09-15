import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedApiKey = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyHint: string;
};

function encryptionKey() {
  const value = process.env.PROVIDER_KEYS_ENCRYPTION_KEY;
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("Provider key encryption is not configured.");
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32)
    throw new Error("Provider key encryption is not configured.");
  return key;
}

export function encryptApiKey(apiKey: string): EncryptedApiKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyHint: apiKey.slice(-4),
  };
}

export function decryptApiKey(value: EncryptedApiKey) {
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(value.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Provider credential cannot be decrypted.");
  }
}
