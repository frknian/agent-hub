import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ownedTask } from "@/services/projects";
import { idInput } from "@/lib/validation";
import { PageHeading, TaskList } from "@/components/workspace";
import { Card, CardContent } from "@/components/ui/card";
import { TaskRunMonitor } from "@/components/task-run-monitor";
import { latestTaskRun } from "@/services/task-runs";
export default async function Task({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!idInput.safeParse(id).success) notFound();
  const task = await ownedTask(user.id, id);
  if (!task) notFound();
  const run = await latestTaskRun(user.id, task.id);
  return (
    <>
      <PageHeading title={task.title} description={task.projectName} />
      <TaskList tasks={[task]} />
      <Card>
        <CardContent className="p-6">
          <h2 className="mb-4 font-semibold">Açıklama</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
            {task.description || "Açıklama eklenmedi."}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <TaskRunMonitor
            taskId={task.id}
            queued={task.status === "queued"}
            initial={run ? JSON.parse(JSON.stringify(run)) : null}
          />
        </CardContent>
      </Card>
    </>
  );
}
