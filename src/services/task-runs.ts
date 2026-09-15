import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { taskRunEvents, taskRuns } from "@/db/schema";
export async function latestTaskRun(userId: string, taskId: string) {
  const [run] = await getDb()
    .select()
    .from(taskRuns)
    .where(and(eq(taskRuns.userId, userId), eq(taskRuns.taskId, taskId)))
    .orderBy(desc(taskRuns.createdAt))
    .limit(1);
  if (!run) return null;
  const events = await getDb()
    .select()
    .from(taskRunEvents)
    .where(
      and(eq(taskRunEvents.userId, userId), eq(taskRunEvents.runId, run.id)),
    )
    .orderBy(taskRunEvents.createdAt);
  return { ...run, events };
}
