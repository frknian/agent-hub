import { AgentSystemSettings } from "@/components/agent-system-settings";
import { PageHeading } from "@/components/workspace";
import { requireUser } from "@/lib/auth";
import { getAgentSystem } from "@/services/agent-systems";
import { listProviderCredentials } from "@/services/providers";
export default async function Page() {
  const user = await requireUser();
  const [system, credentials] = await Promise.all([
    getAgentSystem(user.id),
    listProviderCredentials(user.id),
  ]);
  return (
    <>
      <PageHeading
        title="Agent sistemi"
        description="Model yönlendirmelerini ayarlayın. Bu ayarlar agent çalıştırmaz."
      />
      <AgentSystemSettings
        initial={system}
        connectedProviders={credentials
          .filter((credential) => credential.status === "connected")
          .map((credential) => credential.provider)}
      />
    </>
  );
}
