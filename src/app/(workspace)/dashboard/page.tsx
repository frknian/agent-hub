import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listProjects, listTasks } from "@/services/projects";
import { PageHeading, ProjectGrid, TaskList } from "@/components/workspace";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
export default async function Dashboard() {
  const user = await requireUser();
  const [projects, tasks] = await Promise.all([
    listProjects(user.id),
    listTasks(user.id),
  ]);
  const stats = [
    [
      "Aktif görevler",
      tasks.filter((t) => !["completed", "failed"].includes(t.status)).length,
      "Sıradaki ve devam eden",
    ],
    [
      "Tamamlanan",
      tasks.filter((t) => t.status === "completed").length,
      "Tamamlanan görevler",
    ],
    ["Projeler", projects.length, "Bağlı çalışma alanları"],
    ["Aylık AI maliyeti", "—", "AI kullanımı henüz etkin değil"],
  ];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading
          title="Dashboard"
          description="Projelerine genel bakış ve sıradaki işler."
        />
        <Link href="/projects" className={buttonVariants()}>
          + Proje ekle
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, hint]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">
                {label}
              </p>
              <p className="my-4 text-3xl font-semibold tracking-tight">
                {value}
              </p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <section className="space-y-4">
        <div className="flex justify-between">
          <h2 className="text-lg font-semibold">Projelerin</h2>
          <Link className="text-sm text-primary" href="/projects">
            Tüm projeler →
          </Link>
        </div>
        <ProjectGrid projects={projects} />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Güncel görevler</h2>
        <TaskList tasks={tasks.slice(0, 10)} />
      </section>
    </>
  );
}
