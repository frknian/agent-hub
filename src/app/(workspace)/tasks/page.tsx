import { requireUser } from "@/lib/auth";
import { listTasks } from "@/services/projects";
import { PageHeading, TaskList } from "@/components/workspace";
export default async function Tasks() {
  const user = await requireUser();
  return (
    <>
      <PageHeading
        title="Görevler"
        description="Tüm projelerindeki görevleri takip et."
      />
      <TaskList tasks={await listTasks(user.id)} />
    </>
  );
}
