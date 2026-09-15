import { expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mock = vi.hoisted(() => ({
  where: vi.fn(),
  insert: vi.fn(),
  limit: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            where: (condition: unknown) => {
              mock.where(condition);
              return { limit: mock.limit };
            },
          }),
        }),
      }),
    }),
    insert: mock.insert,
  }),
}));
import { reviewTaskRun } from "./task-review";
it("requires the primary run and project to belong to the authenticated owner", async () => {
  await expect(
    reviewTaskRun(
      "owner-id",
      "run-id",
      {} as Parameters<typeof reviewTaskRun>[2],
    ),
  ).rejects.toThrow("Review unavailable");
  const query = new PgDialect().sqlToQuery(mock.where.mock.calls[0][0]);
  expect(query.sql).toContain('"task_runs"."user_id"');
  expect(query.sql).toContain('"projects"."user_id"');
  expect(query.params.filter((value) => value === "owner-id")).toHaveLength(2);
  expect(mock.insert).not.toHaveBeenCalled();
});
it("creates reviewer run and returns verdict on successful review", async () => {
  mock.limit.mockResolvedValueOnce([{ taskId: "task-123" }]);
  const mockRun = { id: "reviewer-run-id" };
  mock.insert.mockReturnValueOnce({
    values: () => ({
      returning: async () => [mockRun],
    }),
  });
  const reviewResult = {
    verdict: "approve" as const,
    strengths: ["Clean"],
    weaknesses: [],
    missed_issues: [],
    risk_assessment: "Low risk",
    recommended_changes: [],
    confidence: 0.95,
  };
  const reviewModule = await import("@/lib/review");
  const spy = vi
    .spyOn(reviewModule, "executeReview")
    .mockResolvedValueOnce(reviewResult);

  const res = await reviewTaskRun(
    "owner-id",
    "run-id",
    {} as Parameters<typeof reviewTaskRun>[2],
  );
  expect(res).toEqual(reviewResult);
  expect(mock.insert).toHaveBeenCalled();
  spy.mockRestore();
});
