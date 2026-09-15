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
  getGitHubWriteToken: vi.fn(),
  validateRepositoryWriteAccess: vi.fn(),
}));

vi.mock("./github-workspace", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./github-workspace")>();
  return {
    ...actual,
    resolveBaseBranch: workspaceMocks.resolveBaseBranch,
    createCodingBranch: workspaceMocks.createCodingBranch,
    readFileFromBranch: workspaceMocks.readFileFromBranch,
    createBranchCommit: workspaceMocks.createBranchCommit,
    getGitHubWriteToken: workspaceMocks.getGitHubWriteToken,
    validateRepositoryWriteAccess: workspaceMocks.validateRepositoryWriteAccess,
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

  workspaceMocks.getGitHubWriteToken.mockReturnValue("mock-write-token-secret");
  workspaceMocks.validateRepositoryWriteAccess.mockResolvedValue(true);

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

it("rejects coding run when GitHub write token is missing", async () => {
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

  workspaceMocks.getGitHubWriteToken.mockImplementationOnce(() => {
    throw new Error("github_write_credential_missing");
  });

  await expect(startCodingExecution(userId, taskId)).rejects.toThrow(
    "github_write_credential_missing",
  );

  expect(dbMocks.set).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "failed",
      errorCode: "github_write_credential_missing",
    }),
  );
});

it("rejects coding run when target repo write permission is denied", async () => {
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

  workspaceMocks.validateRepositoryWriteAccess.mockRejectedValueOnce(
    new Error("github_write_permission_denied"),
  );

  await expect(startCodingExecution(userId, taskId)).rejects.toThrow(
    "github_write_permission_denied",
  );

  expect(dbMocks.set).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "failed",
      errorCode: "github_write_permission_denied",
    }),
  );
});

it("executes coding run, validates safe files, commits to branch, passes token, and never leaks secrets", async () => {
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

  workspaceMocks.readFileFromBranch.mockImplementation(async (o, r, b, p) => {
    if (p === "src/auth.ts")
      return { content: "export const auth = false;", sha: "blob-1" };
    return null;
  });

  workspaceMocks.createBranchCommit.mockResolvedValueOnce({
    commitSha: "commit-sha-777",
    branch: "agent/task-d52fda24-fix-auth-route",
    treeSha: "tree-sha-888",
  });

  const insertedEvents: string[] = [];
  const insertedEventMetadatas: (string | null)[] = [];
  dbMocks.values.mockImplementation((vals: Record<string, unknown>) => {
    if (typeof vals.eventType === "string") {
      insertedEvents.push(vals.eventType);
      insertedEventMetadatas.push(
        typeof vals.metadataJson === "string" ? vals.metadataJson : null,
      );
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

  // Token is verified to have been passed to GitHub write operations
  expect(workspaceMocks.validateRepositoryWriteAccess).toHaveBeenCalledWith(
    "owner",
    "repo",
    "mock-write-token-secret",
  );
  expect(workspaceMocks.createCodingBranch).toHaveBeenCalledWith(
    "owner",
    "repo",
    "agent/task-d52fda24-fix-auth-route",
    "base-sha-123456",
    "mock-write-token-secret",
  );
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
    token: "mock-write-token-secret",
  });

  // Verify that secret token was NEVER written to event metadata or DB result
  for (const metadata of insertedEventMetadatas) {
    if (metadata) {
      expect(metadata).not.toContain("mock-write-token-secret");
    }
  }

  expect(dbMocks.set).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "completed",
      resultJson: expect.not.stringContaining("mock-write-token-secret"),
    }),
  );
});

it("recovers via repair pass when first model output is malformed JSON", async () => {
  dbMocks.limit
    .mockResolvedValueOnce([
      {
        id: taskId,
        title: "Fix bug",
        description: "repair test",
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
    branch: "agent/task-d52fda24-fix-bug",
    sha: "new-branch-sha-999",
    created: true,
  });

  githubPublicMocks.readRepository.mockResolvedValueOnce({ files: [] });

  // First call: returns malformed output
  providerMocks.createCompletion
    .mockResolvedValueOnce({
      choices: [
        {
          message: {
            content:
              "Sure, here is the code: { summary: 'bad json missing quotes', changes: [] }",
          },
        },
      ],
    })
    // Second call (repair): returns clean valid JSON
    .mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "Fixed properly",
              changes: [
                {
                  path: "src/new.ts",
                  operation: "create",
                  content: "export const x = 1;",
                  reason: "add file",
                },
              ],
            }),
          },
        },
      ],
    });

  workspaceMocks.readFileFromBranch.mockResolvedValue(null);
  workspaceMocks.createBranchCommit.mockResolvedValueOnce({
    commitSha: "commit-sha-repair",
    branch: "agent/task-d52fda24-fix-bug",
    treeSha: "tree-sha-repair",
  });

  const runId = await startCodingExecution(userId, taskId);
  expect(runId).toBe("coding-run-id");
  expect(providerMocks.createCompletion).toHaveBeenCalledTimes(2);
  expect(workspaceMocks.createBranchCommit).toHaveBeenCalled();
});

it("fails with coding_output_invalid when repair pass also fails", async () => {
  dbMocks.limit
    .mockResolvedValueOnce([
      {
        id: taskId,
        title: "Fix bug",
        description: "broken repair",
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
    branch: "agent/task-d52fda24-fix-bug",
    sha: "new-branch-sha-999",
    created: true,
  });

  githubPublicMocks.readRepository.mockResolvedValueOnce({ files: [] });

  // Both calls return invalid JSON
  providerMocks.createCompletion
    .mockResolvedValueOnce({
      choices: [{ message: { content: "completely invalid 1" } }],
    })
    .mockResolvedValueOnce({
      choices: [{ message: { content: "completely invalid 2" } }],
    });

  await expect(startCodingExecution(userId, taskId)).rejects.toThrow(
    "coding_output_invalid",
  );

  expect(dbMocks.set).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "failed",
      errorCode: "coding_output_invalid",
    }),
  );
});

it("fails with coding_output_invalid when output is truncated due to length limit", async () => {
  dbMocks.limit
    .mockResolvedValueOnce([
      {
        id: taskId,
        title: "Fix bug",
        description: "truncation test",
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
    branch: "agent/task-d52fda24-fix-bug",
    sha: "new-branch-sha-999",
    created: true,
  });

  githubPublicMocks.readRepository.mockResolvedValueOnce({ files: [] });

  // Model output has finish_reason: "length"
  providerMocks.createCompletion
    .mockResolvedValueOnce({
      choices: [
        {
          finish_reason: "length",
          message: { content: '{"summary": "cut in half...' },
        },
      ],
    })
    .mockResolvedValueOnce({
      choices: [
        {
          finish_reason: "length",
          message: { content: '{"still": "cut...' },
        },
      ],
    });

  await expect(startCodingExecution(userId, taskId)).rejects.toThrow(
    "coding_output_invalid",
  );

  expect(dbMocks.set).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "failed",
      errorCode: "coding_output_invalid",
    }),
  );
});

it("rejects coding run when 'update' target file does not exist on branch", async () => {
  dbMocks.limit
    .mockResolvedValueOnce([
      {
        id: taskId,
        title: "Fix bug",
        description: "missing file update",
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
    branch: "agent/task-d52fda24-fix-bug",
    sha: "new-branch-sha-999",
    created: true,
  });

  githubPublicMocks.readRepository.mockResolvedValueOnce({ files: [] });

  // Proposes updating a file that does not exist
  const payload = JSON.stringify({
    summary: "Update non-existing",
    changes: [
      {
        path: "src/does-not-exist.ts",
        operation: "update",
        content: "export const a = 1;",
      },
    ],
  });

  providerMocks.createCompletion
    .mockResolvedValueOnce({
      choices: [{ message: { content: payload } }],
    })
    .mockResolvedValueOnce({
      choices: [{ message: { content: payload } }],
    });

  // readFileFromBranch returns null (file does not exist)
  workspaceMocks.readFileFromBranch.mockResolvedValue(null);

  await expect(startCodingExecution(userId, taskId)).rejects.toThrow(
    "coding_output_invalid",
  );
});

it("rejects coding run when 'create' target file already exists on branch", async () => {
  dbMocks.limit
    .mockResolvedValueOnce([
      {
        id: taskId,
        title: "Fix bug",
        description: "existing file create",
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
    branch: "agent/task-d52fda24-fix-bug",
    sha: "new-branch-sha-999",
    created: true,
  });

  githubPublicMocks.readRepository.mockResolvedValueOnce({ files: [] });

  // Proposes creating a file that already exists
  const payload = JSON.stringify({
    summary: "Create already existing",
    changes: [
      {
        path: "src/existing.ts",
        operation: "create",
        content: "export const a = 1;",
      },
    ],
  });

  providerMocks.createCompletion
    .mockResolvedValueOnce({
      choices: [{ message: { content: payload } }],
    })
    .mockResolvedValueOnce({
      choices: [{ message: { content: payload } }],
    });

  // readFileFromBranch returns existing file
  workspaceMocks.readFileFromBranch.mockResolvedValue({
    content: "old",
    sha: "blob-x",
  });

  await expect(startCodingExecution(userId, taskId)).rejects.toThrow(
    "coding_output_invalid",
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

  workspaceMocks.readFileFromBranch.mockResolvedValue(null);

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

  workspaceMocks.readFileFromBranch.mockResolvedValue({
    content: "existing",
    sha: "blob-env",
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
