import { requireUser } from "@/lib/auth";
import { listProjects } from "@/services/projects";
import { EntryForm } from "@/components/forms";
import { PageHeading, ProjectGrid } from "@/components/workspace";
import { Card, CardContent } from "@/components/ui/card";
export default async function Projects() {
  const user = await requireUser();
  const projects = await listProjects(user.id);
  return (
    <>
      <PageHeading
        title="Projeler"
        description="GitHub projelerini çalışma alanına ekle."
      />
      <div className="grid items-start gap-8 xl:grid-cols-[1fr_340px]">
        <ProjectGrid projects={projects} />
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-5 font-semibold">Yeni proje</h2>
            <EntryForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
