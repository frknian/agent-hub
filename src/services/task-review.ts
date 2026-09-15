import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  projects,
  tasks,
  taskRuns,
  taskRunEvents,
  providerCredentials,
} from "@/db/schema";
import { getAgentSystem } from "./agent-systems";
import { decryptApiKey } from "@/lib/provider-crypto";
import { getProviderAdapter } from "@/lib/providers";
import { executeReview, reviewPrompt, type ReviewInput } from "@/lib/review";

const messages: Record<string, string> = {
  review_started: "Kimi incelemesi başladı",
  review_model_request_started: "Kimi inceleme isteği gönderildi",
  review_model_response_received: "Kimi cevabı alındı",
  review_validated: "İnceleme sonucu doğrulandı",
  review_completed: "Kimi incelemesi tamamlandı",
  review_failed: "Kimi incelemesi başarısız; Qwen analizi korundu",
};

export async function reviewTaskRun(
  userId: string,
  primaryRunId: string,
  input: ReviewInput,
) {
  const db = getDb();
  const [primary] = await db
    .select({ taskId: taskRuns.taskId })
    .from(taskRuns)
    .innerJoin(tasks, eq(taskRuns.taskId, tasks.id))
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(taskRuns.id, primaryRunId),
        eq(taskRuns.userId, userId),
        eq(projects.userId, userId),
        eq(taskRuns.agentRole, "primary"),
        eq(taskRuns.status, "completed"),
      ),
    )
    .limit(1);
  if (!primary) throw new Error("Review unavailable");
  const [run] = await db
    .insert(taskRuns)
    .values({
      taskId: primary.taskId,
      userId,
      agentRole: "reviewer",
      provider: "kimi",
      model: "kimi-k2.5",
      status: "running",
    })
    .returning();
  return await executeReview(input, {
    event: (type, failed) =>
      db.insert(taskRunEvents).values({
        runId: run.id,
        userId,
        eventType: type,
        step: type,
        status: failed
          ? "failed"
          : type === "review_model_request_started"
            ? "running"
            : "completed",
        message: messages[type],
        metadataJson: JSON.stringify({ primaryRunId }),
      }),
    resolve: async () => {
      const system = await getAgentSystem(userId);
      const reviewer = system.roles.find((role) => role.role === "reviewer");
      const [credential] = await db
        .select()
        .from(providerCredentials)
        .where(
          and(
            eq(providerCredentials.userId, userId),
            eq(providerCredentials.provider, "kimi"),
            eq(providerCredentials.status, "connected"),
          ),
        )
        .limit(1);
      if (!reviewer || reviewer.provider !== "kimi" || !credential)
        throw new Error("reviewer_provider_missing");
      await db
        .update(taskRuns)
        .set({ model: reviewer.model })
        .where(and(eq(taskRuns.id, run.id), eq(taskRuns.userId, userId)));
      return async (context) => {
        const raw = (await getProviderAdapter("kimi").createCompletion(
          decryptApiKey({
            ciphertext: credential.encryptedApiKey,
            iv: credential.iv,
            authTag: credential.authTag,
            keyHint: credential.keyHint,
          }),
          reviewer.model,
          context,
          credential.baseUrl,
          reviewPrompt,
        )) as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        return {
          content: raw.choices?.[0]?.message?.content ?? "",
          inputTokens: raw.usage?.prompt_tokens,
          outputTokens: raw.usage?.completion_tokens,
        };
      };
    },
    save: (result, usage) =>
      db
        .update(taskRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          resultJson: JSON.stringify(result),
          inputTokens: usage.inputTokens?.toString() ?? null,
          outputTokens: usage.outputTokens?.toString() ?? null,
        })
        .where(and(eq(taskRuns.id, run.id), eq(taskRuns.userId, userId))),
    fail: (errorCode) =>
      db
        .update(taskRuns)
        .set({ status: "failed", completedAt: new Date(), errorCode })
        .where(and(eq(taskRuns.id, run.id), eq(taskRuns.userId, userId))),
  });
}
