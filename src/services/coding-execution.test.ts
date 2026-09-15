import { beforeEach, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  values: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
}));

vi.mock("@/db", () => ({
  getDb: () => ({
    select: dbMocks.select,
    insert: dbMocks.insert,
    update: dbMocks.update,
  }),
}));

const workspaceMocks = vi.hoisted(() => ({
  resolveBaseBranch: vi.fn(),
  createCodingBranch: vi.fn(),
}));

vi.mock("./github-workspace", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./github-workspace")>();
  return {
    ...actual,
    resolveBaseBranch: workspaceMocks.resolveBaseBranch,
    createCodingBranch: workspaceMocks.createCodingBranch,
  };
});

import { startCodingExecution } from "./coding-execution";

const taskId = "d52fda24-1234-4567-89ab-cdef01234567";
const userId = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();

  dbMocks.select.mockReturnValue({
    from: () => ({
      where: dbMocks.where,
      innerJoin: () => ({ where: dbMocks.where }),
    }),
  });
  dbMocks.where.mockReturnValue({ limit: dbMocks.limit });
  dbMocks.insert.mockReturnValue({ values: dbMocks.values });
  dbMocks.values.mockReturnValue({ returning: dbMocks.returning });
  dbMocks.returning.mockResolvedValue([{ id: "coding-run-id" }]);
  dbMocks.update.mockReturnValue({ set: dbMocks.set });
  dbMocks.set.mockReturnValue({ where: vi.fn() });
});

it("rejects coding run when task or project does not belong to user (owner mismatch)", async () => {
  dbMocks.limit.mockResolvedValueOnce([]); // No task found for user
  await expect(startCodingExecution(userId, taskId)).rejects.toThrow(
    "Task unavailable",
  );
  expect(dbMocks.insert).not.toHaveBeenCalled();
});

it("rejects coding run when primary analysis is missing", async () => {
  dbMocks.limit
    .mockResolvedValueOnce([
      {
        id: taskId,
        title: "Fix bug",
        description: "route error",
        projectId: "p1",
        repositoryUrl: "https://github.com/example/repo",
      },
    ])
    .mockResolvedValueOnce([]); // No primary analysis run

  await expect(startCodingExecution(userId, taskId)).rejects.toThrow(
    "analysis_missing",
  );
  expect(dbMocks.insert).not.toHaveBeenCalled();
});

it("rejects coding run when a coding run is already active (duplicate coding run)", async () => {
  dbMocks.limit
    .mockResolvedValueOnce([
      {
        id: taskId,
        title: "Fix bug",
        description: "route error",
        projectId: "p1",
        repositoryUrl: "https://github.com/example/repo",
      },
    ])
    .mockResolvedValueOnce([
      {
        id: "primary-run-id",
        status: "completed",
        resultJson: JSON.stringify({ summary: "analyzed" }),
      },
    ])
    .mockResolvedValueOnce([{ id: "active-coding-id" }]); // Active coding run

  await expect(startCodingExecution(userId, taskId)).rejects.toThrow(
    "Execution already active",
  );
  expect(dbMocks.insert).not.toHaveBeenCalled();
});

it("executes coding run and emits events in exact order", async () => {
  dbMocks.limit
    .mockResolvedValueOnce([
      {
        id: taskId,
        title: "Fix auth route",
        description: "401 issue",
        projectId: "p1",
        repositoryUrl: "https://github.com/owner/repo",
      },
    ])
    .mockResolvedValueOnce([
      {
        id: "primary-run-id",
        status: "completed",
        resultJson: JSON.stringify({ summary: "analyzed" }),
      },
    ])
    .mockResolvedValueOnce([]); // No active coding run

  workspaceMocks.resolveBaseBranch.mockResolvedValueOnce({
    branch: "main",
    sha: "base-sha-123456",
  });
  workspaceMocks.createCodingBranch.mockResolvedValueOnce({
    branch: "agent/task-d52fda24-fix-auth-route",
    sha: "new-branch-sha-999",
    created: true,
  });

  const insertedEvents: string[] = [];
  dbMocks.values.mockImplementation((vals: Record<string, unknown>) => {
    if (typeof vals.eventType === "string") {
      insertedEvents.push(vals.eventType);
    }
    return { returning: async () => [{ id: "coding-run-id" }] };
  });

  const runId = await startCodingExecution(userId, taskId);
  expect(runId).toBe("coding-run-id");

  expect(insertedEvents).toEqual([
    "coding_requested",
    "repository_write_access_validated",
    "base_branch_resolved",
    "coding_branch_created",
    "coding_workspace_ready",
  ]);

  expect(workspaceMocks.resolveBaseBranch).toHaveBeenCalledWith(
    "owner",
    "repo",
  );
  expect(workspaceMocks.createCodingBranch).toHaveBeenCalledWith(
    "owner",
    "repo",
    "agent/task-d52fda24-fix-auth-route",
    "base-sha-123456",
  );

  // Check that final workspace metadata was saved
  expect(dbMocks.set).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "completed",
      resultJson: expect.stringContaining("agent/task-d52fda24-fix-auth-route"),
    }),
  );
});
