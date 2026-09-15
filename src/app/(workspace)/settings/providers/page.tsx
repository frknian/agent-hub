import { ProviderSettings } from "@/components/provider-settings";
import { PageHeading } from "@/components/workspace";
import { requireUser } from "@/lib/auth";
import { listProviderCredentials } from "@/services/providers";
export default async function Page() {
  const user = await requireUser();
  const credentials = await listProviderCredentials(user.id);
  return (
    <>
      <PageHeading
        title="Sağlayıcılar"
        description="Kendi API anahtarlarınızı güvenli biçimde bağlayın."
      />
      <ProviderSettings credentials={credentials} />
    </>
  );
}
