import type { ProviderId } from "@/config/agent-presets";

export const providerCatalog: Record<
  ProviderId,
  { label: string; models: { id: string; label: string }[]; baseUrl: string }
> = {
  qwen: {
    label: "Qwen / Alibaba",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [{ id: "qwen3-coder-next", label: "Qwen3-Coder-Next" }],
  },
  kimi: {
    label: "Kimi / Moonshot",
    baseUrl: "https://api.moonshot.ai/v1",
    models: [{ id: "kimi-k2.5", label: "Kimi K2.5" }],
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: [{ id: "gpt-5.6-sol", label: "GPT-5.6 Sol" }],
  },
};
