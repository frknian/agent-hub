import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { projects, taskRunEvents, taskRuns, tasks } from "@/db/schema";
import { idInput } from "@/lib/validation";
import { parsePublicRepository } from "./github-public";
import {
  generateCodingBranchName,
  resolveBaseBranch,
  createCodingBranch,
} from "./github-workspace";

export const codingEventMessages: Record<string, string> = {
  coding_requested: "Kodlama talep edildi",
  repository_write_access_validated: "Repository yazma erişimi doğrulandı",
  base_branch_resolved: "Base branch doğrulandı",
  coding_branch_created: "Kodlama branch'i oluşturuldu",
  coding_workspace_ready: "Kodlama çalışma alanı hazırlandı",
  coding_failed: "Kodlama çalışma alanı hazırlanamadı",
};

export type CodingWorkspaceMetadata = {
  branch: string;
  baseBranch: string;
  baseSha: string;
  repository: string;
  status: "ready";
};

export async function startCodingExecution(userId: string, taskId: string) {
  idInput.parse(taskId);
  const db = getDb();

  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      projectId: tasks.projectId,
      repositoryUrl: projects.repositoryUrl,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.id, taskId), eq(projects.userId, userId)))
    .limit(1);

  if (!task) throw new Error("Task unavailable");

  // Validate that primary Qwen analysis exists and is completed
  const [primaryRun] = await db
    .select({
      id: taskRuns.id,
      status: taskRuns.status,
      resultJson: taskRuns.resultJson,
    })
    .from(taskRuns)
    .where(
      and(
        eq(taskRuns.taskId, taskId),
        eq(taskRuns.userId, userId),
        eq(taskRuns.agentRole, "primary"),
        eq(taskRuns.status, "completed"),
      ),
    )
    .limit(1);

  if (!primaryRun || !primaryRun.resultJson) {
    throw new Error("analysis_missing");
  }

  // Prevent duplicate concurrent coding runs
  const activeCoding = await db
    .select({ id: taskRuns.id })
    .from(taskRuns)
    .where(
      and(
        eq(taskRuns.taskId, taskId),
        eq(taskRuns.agentRole, "coding"),
        inArray(taskRuns.status, ["pending", "running"]),
      ),
    )
    .limit(1);

  if (activeCoding[0]) throw new Error("Execution already active");

  const [run] = await db
    .insert(taskRuns)
    .values({
      taskId,
      userId,
      agentRole: "coding",
      provider: "qwen",
      model: "coding-foundation",
      status: "running",
    })
    .returning();

  const event = async (
    type: keyof typeof codingEventMessages,
    status: "pending" | "running" | "completed" | "failed" = "completed",
    metadata?: object,
  ) =>
    db.insert(taskRunEvents).values({
      runId: run.id,
      userId,
      eventType: type,
      step: type,
      status,
      message: codingEventMessages[type],
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    });

  try {
    await event("coding_requested");

    const { owner, repo } = parsePublicRepository(task.repositoryUrl);
    await event("repository_write_access_validated");

    const base = await resolveBaseBranch(owner, repo);
    await event("base_branch_resolved", "completed", {
      branch: base.branch,
      sha: base.sha,
    });

    const branchName = generateCodingBranchName(task.id, task.title);
    const branchRes = await createCodingBranch(
      owner,
      repo,
      branchName,
      base.sha,
    );
    await event("coding_branch_created", "completed", {
      branch: branchRes.branch,
      sha: branchRes.sha,
      created: branchRes.created,
    });

    const workspaceMeta: CodingWorkspaceMetadata = {
      branch: branchRes.branch,
      baseBranch: base.branch,
      baseSha: base.sha,
      repository: `${owner}/${repo}`,
      status: "ready",
    };

    await event("coding_workspace_ready", "completed", workspaceMeta);

    await db
      .update(taskRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        resultJson: JSON.stringify(workspaceMeta),
      })
      .where(eq(taskRuns.id, run.id));

    await db
      .update(tasks)
      .set({ updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    return run.id;
  } catch (error) {
    const errorCode =
      error instanceof Error &&
      error.message.startsWith("protected_branch_violation")
        ? "protected_branch_violation"
        : error instanceof Error &&
            error.message.startsWith("invalid_branch_format")
          ? "invalid_branch_format"
          : error instanceof Error &&
              error.message === "github_write_permission_denied"
            ? "github_write_permission_denied"
            : error instanceof Error && error.message === "repository_not_found"
              ? "repository_not_found"
              : "coding_workspace_error";

    await db
      .update(taskRuns)
      .set({ status: "failed", completedAt: new Date(), errorCode })
      .where(eq(taskRuns.id, run.id));

    await event("coding_failed", "failed", { errorCode });
    throw error;
  }
}
