import { beforeEach, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
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
  readFileFromBranch: vi.fn(),
  createBranchCommit: vi.fn(),
}));

vi.mock("./github-workspace", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./github-workspace")>();
  return {
    ...actual,
    resolveBaseBranch: workspaceMocks.resolveBaseBranch,
    createCodingBranch: workspaceMocks.createCodingBranch,
    readFileFromBranch: workspaceMocks.readFileFromBranch,
    createBranchCommit: workspaceMocks.createBranchCommit,
  };
});

const githubPublicMocks = vi.hoisted(() => ({
  readRepository: vi.fn(),
}));

vi.mock("./github-public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./github-public")>();
  return {
    ...actual,
    readRepository: githubPublicMocks.readRepository,
  };
});

const providerMocks = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}));

vi.mock("@/lib/providers", () => ({
  getProviderAdapter: () => ({
    createCompletion: providerMocks.createCompletion,
  }),
}));

vi.mock("@/lib/provider-crypto", () => ({
  decryptApiKey: () => "mock-qwen-key",
}));

vi.mock("./agent-systems", () => ({
  getAgentSystem: async () => ({
    id: "balanced",
    name: "Balanced",
    roles: [{ role: "primary", provider: "qwen", model: "qwen3-coder-next" }],
  }),
}));

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
  dbMocks.where.mockReturnValue({
    limit: dbMocks.limit,
    orderBy: dbMocks.orderBy,
  });
  dbMocks.orderBy.mockReturnValue({
    limit: dbMocks.limit,
  });
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
    .mockResolvedValueOnce([
      {
        id: "reviewer-run-id",
        status: "completed",
        resultJson: JSON.stringify({ verdict: "approve" }),
      },
    ])
    .mockResolvedValueOnce([{ id: "active-coding-id" }]); // Active coding run

  await expect(startCodingExecution(userId, taskId)).rejects.toThrow(
    "Execution already active",
  );
  expect(dbMocks.insert).not.toHaveBeenCalled();
});

it("rejects coding run when Qwen provider is not connected", async () => {
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
    .mockResolvedValueOnce([]) // reviewer run
    .mockResolvedValueOnce([]) // no active coding run
    .mockResolvedValueOnce([]); // no connected Qwen credential

  await expect(startCodingExecution(userId, taskId)).rejects.toThrow(
    "provider_not_connected",
  );
});

it("executes coding run, validates safe files, commits to branch, and emits events in exact order", async () => {
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
    .mockResolvedValueOnce([
      {
        id: "reviewer-run-id",
        status: "completed",
        resultJson: JSON.stringify({ verdict: "approve" }),
      },
    ])
    .mockResolvedValueOnce([]) // no active coding run
    .mockResolvedValueOnce([
      {
        id: "cred-1",
        provider: "qwen",
        status: "connected",
        encryptedApiKey: "enc",
        iv: "iv",
        authTag: "tag",
      },
    ]);

  workspaceMocks.resolveBaseBranch.mockResolvedValueOnce({
    branch: "main",
    sha: "base-sha-123456",
  });
  workspaceMocks.createCodingBranch.mockResolvedValueOnce({
    branch: "agent/task-d52fda24-fix-auth-route",
    sha: "new-branch-sha-999",
    created: true,
  });

  githubPublicMocks.readRepository.mockResolvedValueOnce({
    files: [{ path: "src/auth.ts", content: "export const auth = false;" }],
  });

  providerMocks.createCompletion.mockResolvedValueOnce({
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: "Fixed 401 bug in auth",
            changes: [
              {
                path: "src/auth.ts",
                operation: "update",
                content: "export const auth = true;",
                reason: "Enable auth check",
              },
            ],
            notes: ["Clean patch"],
            risks: [],
            suggested_tests: ["Run auth tests"],
          }),
        },
      },
    ],
    usage: { prompt_tokens: 150, completion_tokens: 80 },
  });

  workspaceMocks.readFileFromBranch.mockResolvedValueOnce({
    content: "export const auth = false;",
    sha: "blob-1",
  });

  workspaceMocks.createBranchCommit.mockResolvedValueOnce({
    commitSha: "commit-sha-777",
    branch: "agent/task-d52fda24-fix-auth-route",
    treeSha: "tree-sha-888",
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
    "coding_context_prepared",
    "coding_model_request_started",
    "patch_generated",
    "patch_validated",
    "files_updated",
    "coding_commit_created",
    "coding_completed",
  ]);

  expect(workspaceMocks.createBranchCommit).toHaveBeenCalledWith({
    owner: "owner",
    repo: "repo",
    branch: "agent/task-d52fda24-fix-auth-route",
    commitMessage: expect.stringContaining("agent: implement task d52fda24"),
    changes: [
      {
        path: "src/auth.ts",
        content: "export const auth = true;",
      },
    ],
  });

  // Verify final run status and metadata
  expect(dbMocks.set).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "completed",
      resultJson: expect.stringContaining("commit-sha-777"),
    }),
  );
});

it("requires approval and halts commit when critical migration or workflow is modified", async () => {
  dbMocks.limit
    .mockResolvedValueOnce([
      {
        id: taskId,
        title: "Add migration",
        description: "db change",
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
    .mockResolvedValueOnce([]) // reviewer
    .mockResolvedValueOnce([]) // active
    .mockResolvedValueOnce([
      {
        id: "cred-1",
        provider: "qwen",
        status: "connected",
        encryptedApiKey: "enc",
        iv: "iv",
        authTag: "tag",
      },
    ]);

  workspaceMocks.resolveBaseBranch.mockResolvedValueOnce({
    branch: "main",
    sha: "base-sha-123456",
  });
  workspaceMocks.createCodingBranch.mockResolvedValueOnce({
    branch: "agent/task-d52fda24-add-migration",
    sha: "new-branch-sha-999",
    created: true,
  });

  githubPublicMocks.readRepository.mockResolvedValueOnce({ files: [] });

  // Qwen proposes modifying a migration file
  providerMocks.createCompletion.mockResolvedValueOnce({
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: "Added DB migration",
            changes: [
              {
                path: "drizzle/0002_add_user_roles.sql",
                operation: "create",
                content: "ALTER TABLE users ADD COLUMN role text;",
                reason: "Add role",
              },
            ],
            notes: [],
            risks: ["Migration risk"],
            suggested_tests: [],
          }),
        },
      },
    ],
  });

  const insertedEvents: string[] = [];
  dbMocks.values.mockImplementation((vals: Record<string, unknown>) => {
    if (typeof vals.eventType === "string") {
      insertedEvents.push(vals.eventType);
    }
    return { returning: async () => [{ id: "coding-run-id" }] };
  });

  await startCodingExecution(userId, taskId);

  expect(insertedEvents).toContain("approval_required");
  // Ensure createBranchCommit was NOT called
  expect(workspaceMocks.createBranchCommit).not.toHaveBeenCalled();

  expect(dbMocks.set).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "completed",
      resultJson: expect.stringContaining("approval_required"),
    }),
  );
});

it("throws and marks run as failed when forbidden file (.env) is targeted", async () => {
  dbMocks.limit
    .mockResolvedValueOnce([
      {
        id: taskId,
        title: "Secret change",
        description: "env edit",
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
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: "cred-1",
        provider: "qwen",
        status: "connected",
        encryptedApiKey: "enc",
        iv: "iv",
        authTag: "tag",
      },
    ]);

  workspaceMocks.resolveBaseBranch.mockResolvedValueOnce({
    branch: "main",
    sha: "base-sha-123456",
  });
  workspaceMocks.createCodingBranch.mockResolvedValueOnce({
    branch: "agent/task-d52fda24-secret-change",
    sha: "new-branch-sha-999",
    created: true,
  });

  githubPublicMocks.readRepository.mockResolvedValueOnce({ files: [] });

  // Qwen attempts to modify .env
  providerMocks.createCompletion.mockResolvedValueOnce({
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: "Modified env",
            changes: [
              {
                path: ".env",
                operation: "update",
                content: "SECRET=123",
                reason: "add secret",
              },
            ],
            notes: [],
            risks: [],
            suggested_tests: [],
          }),
        },
      },
    ],
  });

  await expect(startCodingExecution(userId, taskId)).rejects.toThrow(
    /Güvenlik kuralı/i,
  );

  expect(workspaceMocks.createBranchCommit).not.toHaveBeenCalled();
  expect(dbMocks.set).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "failed",
      errorCode: "forbidden_file_modification",
    }),
  );
});
