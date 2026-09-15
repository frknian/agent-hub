import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  projects,
  providerCredentials,
  taskRunEvents,
  taskRuns,
  tasks,
} from "@/db/schema";
import { idInput } from "@/lib/validation";
import { decryptApiKey } from "@/lib/provider-crypto";
import { getProviderAdapter } from "@/lib/providers";
import { getAgentSystem } from "./agent-systems";
import { parsePublicRepository, readRepository } from "./github-public";
import {
  generateCodingBranchName,
  resolveBaseBranch,
  createCodingBranch,
  createBranchCommit,
  readFileFromBranch,
} from "./github-workspace";
import {
  buildCodingContext,
  codingPrompt,
  generateSimpleDiff,
  parseCodingResponse,
  validateFileSafety,
  type CodingResult,
  type FileDiff,
} from "@/lib/coding";

export const codingEventMessages: Record<string, string> = {
  coding_requested: "Kodlama talep edildi",
  repository_write_access_validated: "Repository yazma erişimi doğrulandı",
  base_branch_resolved: "Base branch doğrulandı",
  coding_branch_created: "Kodlama branch'i oluşturuldu",
  coding_workspace_ready: "Kodlama çalışma alanı hazırlandı",
  coding_context_prepared: "Kodlama bağlamı hazırlandı",
  coding_model_request_started: "Qwen kod değişikliğini üretiyor",
  patch_generated: "Kod değişiklikleri alındı",
  patch_validated: "Patch güvenlik ve şema kontrollerinden geçti",
  files_updated: "Dosya değişiklikleri hazırlandı",
  coding_commit_created: "Kodlama commiti oluşturuldu",
  coding_completed: "Kodlama tamamlandı",
  approval_required: "Kritik sistem dosyası değişikliği için onay gerekli",
  coding_conflict: "Branch çakışması tespit edildi",
  coding_failed: "Kodlama başarısız",
};

export type CodingExecutionResult = {
  branch: string;
  baseBranch: string;
  baseSha: string;
  commitSha?: string;
  repository: string;
  summary: string;
  notes: string[];
  risks: string[];
  suggested_tests: string[];
  changedFiles: number;
  additions: number;
  deletions: number;
  diffs: FileDiff[];
  status: "completed" | "approval_required";
  approvalReason?: string;
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

  // 1. Validate primary Qwen analysis exists and is completed
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
    .orderBy(desc(taskRuns.createdAt))
    .limit(1);

  if (!primaryRun || !primaryRun.resultJson) {
    throw new Error("analysis_missing");
  }

  // 2. Fetch Kimi reviewer result if available
  const [reviewerRun] = await db
    .select({
      id: taskRuns.id,
      resultJson: taskRuns.resultJson,
    })
    .from(taskRuns)
    .where(
      and(
        eq(taskRuns.taskId, taskId),
        eq(taskRuns.userId, userId),
        eq(taskRuns.agentRole, "reviewer"),
        eq(taskRuns.status, "completed"),
      ),
    )
    .orderBy(desc(taskRuns.createdAt))
    .limit(1);

  let analysisData: Record<string, unknown> = {};
  let reviewData: Record<string, unknown> | null = null;
  try {
    analysisData = JSON.parse(primaryRun.resultJson);
  } catch {
    throw new Error("analysis_missing");
  }
  if (reviewerRun?.resultJson) {
    try {
      reviewData = JSON.parse(reviewerRun.resultJson);
    } catch {
      reviewData = null;
    }
  }

  // 3. Prevent duplicate concurrent coding runs
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

  // 4. Resolve Qwen credential
  const system = await getAgentSystem(userId);
  const primaryConfig = system.roles.find((r) => r.role === "primary");
  const modelName = primaryConfig?.model || "qwen3-coder-next";

  const [credential] = await db
    .select()
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.userId, userId),
        eq(providerCredentials.provider, "qwen"),
        eq(providerCredentials.status, "connected"),
      ),
    )
    .limit(1);

  if (!credential) throw new Error("provider_not_connected");

  const [run] = await db
    .insert(taskRuns)
    .values({
      taskId,
      userId,
      agentRole: "coding",
      provider: "qwen",
      model: modelName,
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

    // 5. Create isolated coding branch
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

    await event("coding_workspace_ready", "completed", {
      branch: branchRes.branch,
      baseSha: base.sha,
    });

    // 6. Read relevant repository files for context
    const repoContent = await readRepository(
      task.repositoryUrl,
      `${task.title} ${task.description}`,
    );

    const contextPayload = buildCodingContext({
      task: { title: task.title, description: task.description },
      repository: { owner, repo, branch: branchRes.branch },
      analysis: analysisData,
      review: reviewData,
      files: repoContent.files,
    });

    await event("coding_context_prepared", "completed", {
      filesCount: repoContent.files.length,
      contextLength: contextPayload.length,
    });

    // 7. Request Qwen Coder model
    await event("coding_model_request_started", "running");

    const apiKey = decryptApiKey({
      ciphertext: credential.encryptedApiKey,
      iv: credential.iv,
      authTag: credential.authTag,
      keyHint: credential.keyHint,
    });

    const rawResponse = (await getProviderAdapter("qwen").createCompletion(
      apiKey,
      modelName,
      contextPayload,
      credential.baseUrl,
      codingPrompt,
    )) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    let patchContent = rawResponse.choices?.[0]?.message?.content ?? "";
    await event("patch_generated");

    // 8. Validate patch format with exactly 1 bounded repair
    let codingResult: CodingResult;
    try {
      codingResult = parseCodingResponse(patchContent);
    } catch {
      // One bounded repair attempt
      const repairResponse = (await getProviderAdapter("qwen").createCompletion(
        apiKey,
        modelName,
        `Reformat the following output into valid JSON schema. Return ONLY valid JSON: {"summary":string,"changes":[{"path":string,"operation":"update"|"create","content":string,"reason":string}],"notes":string[],"risks":string[],"suggested_tests":string[]}. DATA:\n${patchContent.slice(0, 32_000)}`,
        credential.baseUrl,
        codingPrompt,
      )) as typeof rawResponse;

      patchContent = repairResponse.choices?.[0]?.message?.content ?? "";
      codingResult = parseCodingResponse(patchContent);
    }

    // 9. File safety policy checks
    let approvalNeeded = false;
    let approvalReason = "";

    for (const change of codingResult.changes) {
      const safety = validateFileSafety(change.path);
      if (!safety.allowed) {
        throw new Error(safety.reason || "forbidden_file_modification");
      }
      if (safety.approvalRequired) {
        approvalNeeded = true;
        approvalReason = safety.reason || "Sensitive system file change";
      }
    }

    await event("patch_validated", "completed", {
      changesCount: codingResult.changes.length,
      approvalNeeded,
    });

    if (approvalNeeded) {
      // If critical files need approval, stop before mutating branch and record status
      const approvalResult: CodingExecutionResult = {
        branch: branchRes.branch,
        baseBranch: base.branch,
        baseSha: base.sha,
        repository: `${owner}/${repo}`,
        summary: codingResult.summary,
        notes: codingResult.notes,
        risks: codingResult.risks,
        suggested_tests: codingResult.suggested_tests,
        changedFiles: codingResult.changes.length,
        additions: 0,
        deletions: 0,
        diffs: [],
        status: "approval_required",
        approvalReason,
      };

      await event("approval_required", "completed", { reason: approvalReason });

      await db
        .update(taskRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          resultJson: JSON.stringify(approvalResult),
        })
        .where(eq(taskRuns.id, run.id));

      return run.id;
    }

    // 10. Generate file diffs
    const diffs: FileDiff[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const change of codingResult.changes) {
      const existing = await readFileFromBranch(
        owner,
        repo,
        branchRes.branch,
        change.path,
      );
      const oldContent = existing?.content ?? "";
      const fileDiff = generateSimpleDiff(
        oldContent,
        change.content,
        change.path,
      );
      diffs.push(fileDiff);
      totalAdditions += fileDiff.additions;
      totalDeletions += fileDiff.deletions;
    }

    await event("files_updated", "completed", {
      changedFiles: diffs.length,
      additions: totalAdditions,
      deletions: totalDeletions,
    });

    // 11. Create atomic commit on isolated coding branch
    const shortTaskId = task.id.replace(/-/g, "").slice(0, 8);
    const commitMessage = `agent: implement task ${shortTaskId}\n\n${codingResult.summary}`;

    const commitResult = await createBranchCommit({
      owner,
      repo,
      branch: branchRes.branch,
      commitMessage,
      changes: codingResult.changes.map((c) => ({
        path: c.path,
        content: c.content,
      })),
    });

    await event("coding_commit_created", "completed", {
      commitSha: commitResult.commitSha,
      branch: branchRes.branch,
    });

    // 12. Finalize coding run
    const finalResult: CodingExecutionResult = {
      branch: branchRes.branch,
      baseBranch: base.branch,
      baseSha: base.sha,
      commitSha: commitResult.commitSha,
      repository: `${owner}/${repo}`,
      summary: codingResult.summary,
      notes: codingResult.notes,
      risks: codingResult.risks,
      suggested_tests: codingResult.suggested_tests,
      changedFiles: codingResult.changes.length,
      additions: totalAdditions,
      deletions: totalDeletions,
      diffs,
      status: "completed",
    };

    await db
      .update(taskRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        resultJson: JSON.stringify(finalResult),
        inputTokens: rawResponse.usage?.prompt_tokens?.toString() ?? null,
        outputTokens: rawResponse.usage?.completion_tokens?.toString() ?? null,
      })
      .where(eq(taskRuns.id, run.id));

    await event("coding_completed", "completed", {
      commitSha: commitResult.commitSha,
      changedFiles: finalResult.changedFiles,
    });

    await db
      .update(tasks)
      .set({ updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    return run.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errorCode = message.includes("coding_conflict")
      ? "coding_conflict"
      : message.startsWith("protected_branch_violation")
        ? "protected_branch_violation"
        : message.startsWith("invalid_branch_format")
          ? "invalid_branch_format"
          : message.startsWith("Dosya güvenlik kuralı ihlali")
            ? "forbidden_file_modification"
            : message === "github_write_permission_denied"
              ? "github_write_permission_denied"
              : message === "repository_not_found"
                ? "repository_not_found"
                : message === "provider_not_connected"
                  ? "provider_not_connected"
                  : "coding_failed";

    await db
      .update(taskRuns)
      .set({ status: "failed", completedAt: new Date(), errorCode })
      .where(eq(taskRuns.id, run.id));

    await event("coding_failed", "failed", { errorCode });
    throw error;
  }
}
