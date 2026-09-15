import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects, tasks } from "@/db/schema";
import {
  idInput,
  parseRepository,
  projectInput,
  taskInput,
} from "@/lib/validation";
export async function listProjects(userId: string) {
  return getDb()
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt));
}
export async function ownedProject(userId: string, id: string) {
  if (!idInput.safeParse(id).success) return null;
  const [project] = await getDb()
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);
  return project ?? null;
}
export async function listTasks(userId: string, projectId?: string) {
  return getDb()
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      createdAt: tasks.createdAt,
      projectName: projects.name,
      projectId: projects.id,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.userId, userId),
        projectId ? eq(tasks.projectId, idInput.parse(projectId)) : undefined,
      ),
    )
    .orderBy(desc(tasks.createdAt));
}
export async function createProject(userId: string, input: unknown) {
  const data = projectInput.parse(input);
  return getDb()
    .insert(projects)
    .values({ userId, name: data.name, ...parseRepository(data.repositoryUrl) })
    .onConflictDoNothing()
    .returning({ id: projects.id });
}
export async function createTask(userId: string, input: unknown) {
  const data = taskInput.parse(input);
  if (!(await ownedProject(userId, data.projectId)))
    throw new Error("Project unavailable");
  return getDb()
    .insert(tasks)
    .values({ ...data, status: "queued" })
    .returning({ id: tasks.id });
}

export async function ownedTask(userId: string, id: string) {
  if (!idInput.safeParse(id).success) return null;
  const [task] = await getDb()
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      createdAt: tasks.createdAt,
      projectName: projects.name,
      projectId: projects.id,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.id, id), eq(projects.userId, userId)))
    .limit(1);
  return task ?? null;
}
