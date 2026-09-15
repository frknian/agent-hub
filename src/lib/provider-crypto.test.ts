import { afterEach, describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey } from "./provider-crypto";

const previous = process.env.PROVIDER_KEYS_ENCRYPTION_KEY;
afterEach(() => {
  process.env.PROVIDER_KEYS_ENCRYPTION_KEY = previous;
});
describe("provider credential encryption", () => {
  it("round trips an API key without exposing it in the payload", () => {
    process.env.PROVIDER_KEYS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      "base64",
    );
    const encrypted = encryptApiKey("example-provider-key");
    expect(encrypted.ciphertext).not.toContain("example-provider-key");
    expect(decryptApiKey(encrypted)).toBe("example-provider-key");
  });
  it("rejects decryption with a different key", () => {
    process.env.PROVIDER_KEYS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      "base64",
    );
    const encrypted = encryptApiKey("example-provider-key");
    process.env.PROVIDER_KEYS_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString(
      "base64",
    );
    expect(() => decryptApiKey(encrypted)).toThrow(
      "Provider credential cannot be decrypted.",
    );
  });
});
