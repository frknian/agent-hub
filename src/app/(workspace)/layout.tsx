import { requireUser } from "@/lib/auth";
import { Navigation } from "@/components/navigation";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
export const dynamic = "force-dynamic";
export default async function Workspace({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <>
      <Navigation />
      <div className="md:ml-60">
        <header className="flex h-20 items-center justify-between border-b bg-card px-5 lg:px-10">
          <span className="text-sm font-semibold">
            Çalışma alanı{" "}
            <span className="ml-2 rounded-full bg-accent px-2 py-1 text-[10px] text-primary">
              M1
            </span>
          </span>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {user.name}
            </span>
            <ThemeSwitcher compact />
            <AuthButton logout />
          </div>
        </header>
        <main
          id="main"
          className="mx-auto max-w-7xl space-y-8 px-5 py-8 pb-28 md:pb-10 lg:px-10"
        >
          {children}
        </main>
      </div>
    </>
  );
}
