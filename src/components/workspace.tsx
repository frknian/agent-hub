import Link from "next/link";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import type { listProjects, listTasks } from "@/services/projects";
const labels = {
  queued: "Sırada",
  planning: "Planlanıyor",
  running: "Çalışıyor",
  reviewing: "İnceleniyor",
  testing: "Test ediliyor",
  waiting_approval: "Onay bekliyor",
  completed: "Tamamlandı",
  failed: "Başarısız",
};
export function PageHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
export function ProjectGrid({
  projects,
}: {
  projects: Awaited<ReturnType<typeof listProjects>>;
}) {
  return projects.length ? (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((p) => (
        <Link key={p.id} href={`/projects/${p.id}`}>
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardContent className="p-5">
              <span className="mb-5 inline-flex size-10 items-center justify-center rounded-xl bg-accent text-lg font-bold text-primary">
                {p.name.slice(0, 1)}
              </span>
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-2 truncate text-xs text-muted-foreground">
                {p.repositoryOwner}/{p.repositoryName}
              </p>
              <p className="mt-5 text-xs text-primary">Projeyi aç →</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  ) : (
    <Empty text="Henüz proje yok. İlk GitHub projenizi ekleyin." />
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">
        {text}
      </CardContent>
    </Card>
  );
}
export function TaskList({
  tasks,
}: {
  tasks: Awaited<ReturnType<typeof listTasks>>;
}) {
  return tasks.length ? (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {["Görev", "Proje", "Durum", "Oluşturuldu"].map((h) => (
                <th key={h} className="p-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="min-w-48 max-w-sm p-4">
                  <Link
                    className="font-medium hover:text-primary"
                    href={`/tasks/${t.id}`}
                  >
                    {t.title}
                  </Link>
                </td>
                <td className="p-4 text-muted-foreground">
                  <Link href={`/projects/${t.projectId}`}>{t.projectName}</Link>
                </td>
                <td className="whitespace-nowrap p-4">
                  <Badge
                    variant={
                      t.status === "failed"
                        ? "destructive"
                        : t.status === "completed"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {labels[t.status]}
                  </Badge>
                </td>
                <td className="whitespace-nowrap p-4 text-xs text-muted-foreground">
                  <time dateTime={t.createdAt.toISOString()}>
                    {new Intl.DateTimeFormat("tr-TR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Europe/Istanbul",
                    }).format(t.createdAt)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  ) : (
    <Empty text="Henüz görev yok. Bir proje seçerek ilk görevinizi oluşturun." />
  );
}
