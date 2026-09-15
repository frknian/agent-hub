import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { taskRunEvents, taskRuns } from "@/db/schema";
export async function latestTaskRun(userId: string, taskId: string) {
  const [run] = await getDb()
    .select()
    .from(taskRuns)
    .where(
      and(
        eq(taskRuns.userId, userId),
        eq(taskRuns.taskId, taskId),
        eq(taskRuns.agentRole, "primary"),
      ),
    )
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
  const [reviewer] = await getDb()
    .select()
    .from(taskRuns)
    .where(
      and(
        eq(taskRuns.userId, userId),
        eq(taskRuns.taskId, taskId),
        eq(taskRuns.agentRole, "reviewer"),
        gte(taskRuns.createdAt, run.createdAt),
      ),
    )
    .orderBy(desc(taskRuns.createdAt))
    .limit(1);
  const reviewEvents = reviewer
    ? await getDb()
        .select()
        .from(taskRunEvents)
        .where(
          and(
            eq(taskRunEvents.userId, userId),
            eq(taskRunEvents.runId, reviewer.id),
          ),
        )
        .orderBy(taskRunEvents.createdAt)
    : [];
  const [coding] = await getDb()
    .select()
    .from(taskRuns)
    .where(
      and(
        eq(taskRuns.userId, userId),
        eq(taskRuns.taskId, taskId),
        eq(taskRuns.agentRole, "coding"),
        gte(taskRuns.createdAt, run.createdAt),
      ),
    )
    .orderBy(desc(taskRuns.createdAt))
    .limit(1);
  const codingEvents = coding
    ? await getDb()
        .select()
        .from(taskRunEvents)
        .where(
          and(
            eq(taskRunEvents.userId, userId),
            eq(taskRunEvents.runId, coding.id),
          ),
        )
        .orderBy(taskRunEvents.createdAt)
    : [];
  return {
    ...run,
    reviewer: reviewer ?? null,
    coding: coding ?? null,
    events: [...events, ...reviewEvents, ...codingEvents].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    ),
  };
}
