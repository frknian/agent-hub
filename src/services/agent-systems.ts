import "server-only";
import { and, eq } from "drizzle-orm";
import {
  BALANCED_DEVELOPER_PRESET,
  type AgentRoute,
  type ProviderId,
} from "@/config/agent-presets";
import { getDb } from "@/db";
import {
  agentRoleConfigs,
  agentSystems,
  providerCredentials,
} from "@/db/schema";
import { agentSystemInput } from "@/lib/validation";

export function validateConnectedProviders(
  roles: readonly AgentRoute[],
  connected: readonly ProviderId[],
) {
  return roles.every((role) => connected.includes(role.provider));
}
export async function getAgentSystem(userId: string) {
  const [system] = await getDb()
    .select()
    .from(agentSystems)
    .where(eq(agentSystems.userId, userId))
    .limit(1);
  if (!system)
    return {
      mode: "preset" as const,
      premiumApproval: "manual" as const,
      roles: [...BALANCED_DEVELOPER_PRESET.roles],
    };
  const roles = await getDb()
    .select({
      role: agentRoleConfigs.role,
      provider: agentRoleConfigs.provider,
      model: agentRoleConfigs.model,
    })
    .from(agentRoleConfigs)
    .where(eq(agentRoleConfigs.systemId, system.id));
  return {
    mode: system.mode,
    premiumApproval: system.premiumApproval,
    roles: roles.length ? roles : [...BALANCED_DEVELOPER_PRESET.roles],
  };
}
export async function saveAgentSystem(userId: string, input: unknown) {
  const data = agentSystemInput.parse(input);
  const connected = await getDb()
    .select({ provider: providerCredentials.provider })
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.userId, userId),
        eq(providerCredentials.status, "connected"),
      ),
    );
  if (
    !validateConnectedProviders(
      data.roles as AgentRoute[],
      connected.map((item) => item.provider),
    )
  )
    throw new Error("Selected provider is not connected");
  const [system] = await getDb()
    .insert(agentSystems)
    .values({
      userId,
      mode: data.mode,
      presetId: data.mode === "preset" ? BALANCED_DEVELOPER_PRESET.id : null,
      premiumApproval: data.premiumApproval,
    })
    .onConflictDoUpdate({
      target: agentSystems.userId,
      set: {
        mode: data.mode,
        presetId: data.mode === "preset" ? BALANCED_DEVELOPER_PRESET.id : null,
        premiumApproval: data.premiumApproval,
        updatedAt: new Date(),
      },
    })
    .returning({ id: agentSystems.id });
  for (const role of data.roles) {
    await getDb()
      .insert(agentRoleConfigs)
      .values({ systemId: system.id, ...role })
      .onConflictDoUpdate({
        target: [agentRoleConfigs.systemId, agentRoleConfigs.role],
        set: {
          provider: role.provider,
          model: role.model,
          updatedAt: new Date(),
        },
      });
  }
}
