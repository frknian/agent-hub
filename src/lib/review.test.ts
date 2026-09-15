import { expect, it, vi } from "vitest";
import { executeReview, reviewContext, type ReviewInput } from "./review";

const input: ReviewInput = {
  task: { title: "Bug", description: "Fix route" },
  repository: { owner: "example", repo: "public", branch: "main" },
  analysis: {
    task_type: "bug_fix",
    summary: "Primary retained",
    root_causes: [],
    relevant_files: [{ path: "route.ts", reason: "Relevant" }],
    implementation_plan: [],
    risks: [],
    test_plan: [],
    confidence: 0.8,
  },
  files: [
    { path: "route.ts", content: "code" },
    { path: "unrelated.ts", content: "excluded" },
  ],
};
const result = {
  verdict: "approve",
  strengths: ["Good"],
  weaknesses: [],
  missed_issues: [],
  risk_assessment: "Low",
  recommended_changes: [],
  confidence: 0.9,
};
function mocks(content = JSON.stringify(result)) {
  return {
    resolve: vi.fn(async () => async () => ({
      content,
      inputTokens: 10,
      outputTokens: 20,
    })),
    event: vi
      .fn<(type: string, failed?: boolean) => Promise<void>>()
      .mockResolvedValue(undefined),
    save: vi.fn(async () => {}),
    fail: vi.fn(async () => {}),
  };
}
it("saves reviewer success and orders real events", async () => {
  const dependencies = mocks();
  expect(await executeReview(input, dependencies)).toEqual(result);
  expect(dependencies.event.mock.calls.map((call) => call[0])).toEqual([
    "review_started",
    "review_model_request_started",
    "review_model_response_received",
    "review_validated",
    "review_completed",
  ]);
  expect(dependencies.save).toHaveBeenCalledWith(
    result,
    expect.objectContaining({ inputTokens: 10, outputTokens: 20 }),
  );
  expect(dependencies.fail).not.toHaveBeenCalled();
});
it("rejects invalid reviewer output and preserves the Qwen analysis", async () => {
  const original = JSON.stringify(input.analysis);
  const dependencies = mocks('{"verdict":"wrong"}');
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await executeReview(input, dependencies)).toBeNull();
  expect(dependencies.fail).toHaveBeenCalledWith("reviewer_invalid_response");
  expect(dependencies.save).not.toHaveBeenCalled();
  expect(JSON.stringify(input.analysis)).toBe(original);
  expect(dependencies.event.mock.calls.at(-1)).toEqual(["review_failed", true]);
  log.mockRestore();
});
it("records a missing provider without sending a model request", async () => {
  const dependencies = mocks();
  dependencies.resolve.mockRejectedValue(
    new Error("reviewer_provider_missing"),
  );
  expect(await executeReview(input, dependencies)).toBeNull();
  expect(dependencies.fail).toHaveBeenCalledWith("reviewer_provider_missing");
  expect(dependencies.event.mock.calls.map((call) => call[0])).toEqual([
    "review_started",
    "review_failed",
  ]);
});
it("includes only Qwen-selected files with bounded content", () => {
  const context = JSON.parse(
    reviewContext({
      ...input,
      files: [...input.files, { path: "route.ts", content: "x".repeat(10000) }],
    }),
  );
  expect(
    context.selected_files.every(
      (file: { path: string; content: string }) =>
        file.path === "route.ts" && file.content.length <= 4000,
    ),
  ).toBe(true);
  expect(JSON.stringify(context)).not.toContain("excluded");
});
it("accepts all valid Kimi review verdicts: approve, needs_revision, insufficient_context", async () => {
  for (const verdict of [
    "approve",
    "needs_revision",
    "insufficient_context",
  ] as const) {
    const customResult = { ...result, verdict };
    const dependencies = mocks(JSON.stringify(customResult));
    const reviewed = await executeReview(input, dependencies);
    expect(reviewed?.verdict).toBe(verdict);
    expect(dependencies.save).toHaveBeenCalledWith(
      customResult,
      expect.anything(),
    );
  }
});
