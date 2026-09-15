import Link from "next/link";
import { PageHeading } from "@/components/workspace";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getAgentSystem } from "@/services/agent-systems";
export default async function Page() {
  const user = await requireUser();
  const system = await getAgentSystem(user.id);
  return (
    <>
      <PageHeading
        title="Agentlar"
        description="Yönlendirme ve rol ayarlarınız."
      />
      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Bu ekranda yalnızca yapılandırma gösterilir; agent çalıştırma henüz
            etkin değildir.
          </p>
          <div className="grid gap-3 md:grid-cols-4">
            {system.roles.map((role) => (
              <div className="rounded-lg border p-3" key={role.role}>
                <p className="font-medium capitalize">{role.role}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {role.provider} · {role.model}
                </p>
              </div>
            ))}
          </div>
          <Link
            className="text-sm font-medium text-primary hover:underline"
            href="/settings/agent-system"
          >
            Agent sistemini düzenle
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
