import "server-only";
import { and, eq } from "drizzle-orm";
import type { ProviderId } from "@/config/agent-presets";
import { getDb } from "@/db";
import { providerCredentials } from "@/db/schema";
import { decryptApiKey, encryptApiKey } from "@/lib/provider-crypto";
import { getProviderAdapter, ProviderConnectionError } from "@/lib/providers";
import { isMissingRelationError } from "@/lib/database-errors";
import { providerCredentialInput } from "@/lib/validation";

export async function listProviderCredentials(userId: string) {
  try {
    return await getDb()
      .select({
        provider: providerCredentials.provider,
        keyHint: providerCredentials.keyHint,
        status: providerCredentials.status,
        lastTestedAt: providerCredentials.lastTestedAt,
        baseUrl: providerCredentials.baseUrl,
      })
      .from(providerCredentials)
      .where(eq(providerCredentials.userId, userId));
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}
export async function saveProviderCredential(userId: string, input: unknown) {
  const data = providerCredentialInput.parse(input);
  const encrypted = encryptApiKey(data.apiKey);
  const stored = {
    encryptedApiKey: encrypted.ciphertext,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    keyHint: encrypted.keyHint,
    baseUrl: data.baseUrl || null,
  };
  await getDb()
    .insert(providerCredentials)
    .values({ userId, provider: data.provider, ...stored })
    .onConflictDoUpdate({
      target: [providerCredentials.userId, providerCredentials.provider],
      set: {
        ...stored,
        status: "untested",
        lastTestedAt: null,
        updatedAt: new Date(),
      },
    });
}
export async function removeProviderCredential(
  userId: string,
  provider: ProviderId,
) {
  await getDb()
    .delete(providerCredentials)
    .where(
      and(
        eq(providerCredentials.userId, userId),
        eq(providerCredentials.provider, provider),
      ),
    );
}
export async function testProviderCredential(
  userId: string,
  provider: ProviderId,
) {
  const [credential] = await getDb()
    .select()
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.userId, userId),
        eq(providerCredentials.provider, provider),
      ),
    )
    .limit(1);
  if (!credential) throw new Error("Provider credential unavailable");
  try {
    await getProviderAdapter(provider).testConnection(
      decryptApiKey({
        ciphertext: credential.encryptedApiKey,
        iv: credential.iv,
        authTag: credential.authTag,
        keyHint: credential.keyHint,
      }),
      credential.baseUrl,
    );
    await getDb()
      .update(providerCredentials)
      .set({
        status: "connected",
        lastTestedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(providerCredentials.id, credential.id));
    return { status: "connected" as const };
  } catch (error) {
    await getDb()
      .update(providerCredentials)
      .set({ status: "error", lastTestedAt: new Date(), updatedAt: new Date() })
      .where(eq(providerCredentials.id, credential.id));
    return {
      status: "error" as const,
      errorType:
        error instanceof ProviderConnectionError
          ? error.type
          : ("unknown" as const),
    };
  }
}
