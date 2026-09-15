import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ownedProject, listTasks } from "@/services/projects";
import { PageHeading, TaskList } from "@/components/workspace";
import { EntryForm } from "@/components/forms";
import { Card, CardContent } from "@/components/ui/card";
export default async function Project({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const project = await ownedProject(user.id, id);
  if (!project) notFound();
  const tasks = await listTasks(user.id, id);
  return (
    <>
      <PageHeading
        title={project.name}
        description={`${project.repositoryOwner}/${project.repositoryName}`}
      />
      <a
        href={project.repositoryUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary"
      >
        GitHub’da görüntüle ↗
      </a>
      <div className="grid items-start gap-8 xl:grid-cols-[1fr_360px]">
        <TaskList tasks={tasks} />
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-5 font-semibold">Görev oluştur</h2>
            <EntryForm projectId={id} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
