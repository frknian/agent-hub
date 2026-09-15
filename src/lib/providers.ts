import "server-only";
import type { ProviderId } from "@/config/agent-presets";
import { providerCatalog } from "@/config/provider-catalog";

export type ProviderAdapter = {
  testConnection(apiKey: string): Promise<void>;
  listModels(apiKey: string): Promise<string[]>;
  createCompletion(
    apiKey: string,
    model: string,
    input: string,
  ): Promise<unknown>;
};

function adapter(provider: ProviderId): ProviderAdapter {
  const baseUrl = providerCatalog[provider].baseUrl;
  const request = async (apiKey: string, path: string, init?: RequestInit) => {
    const response = await fetch(`${baseUrl}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(`Provider request failed (${response.status})`);
    return response;
  };
  return {
    async testConnection(apiKey) {
      await request(apiKey, "models");
    },
    async listModels(apiKey) {
      const body = (await (await request(apiKey, "models")).json()) as {
        data?: { id?: string }[];
      };
      return body.data?.flatMap((item) => (item.id ? [item.id] : [])) ?? [];
    },
    async createCompletion(apiKey, model, input) {
      return (
        await request(apiKey, "chat/completions", {
          method: "POST",
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: input }],
          }),
        })
      ).json();
    },
  };
}

export function getProviderAdapter(provider: ProviderId) {
  return adapter(provider);
}
