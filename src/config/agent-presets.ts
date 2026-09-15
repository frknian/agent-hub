import type { agentRoles, providerIds } from "@/lib/validation";

export type ProviderId = (typeof providerIds)[number];
export type AgentRole = (typeof agentRoles)[number];
export type AgentRoute = {
  role: AgentRole;
  provider: ProviderId;
  model: string;
};

export const BALANCED_DEVELOPER_PRESET = {
  id: "balanced-developer-v1",
  label: "Balanced Developer",
  premiumApproval: "manual" as const,
  roles: [
    { role: "primary", provider: "qwen", model: "qwen3-coder-next" },
    { role: "reviewer", provider: "kimi", model: "kimi-k2.5" },
    { role: "fallback", provider: "openai", model: "gpt-5.6-sol" },
    { role: "premium", provider: "openai", model: "gpt-5.6-sol" },
  ] satisfies AgentRoute[],
} as const;
