import { afterEach, expect, it, vi } from "vitest";
import {
  generateCodingBranchName,
  assertProtectedBranch,
  resolveBaseBranch,
  checkBranchExists,
  createCodingBranch,
  readFileFromBranch,
  createBranchCommit,
  slugify,
} from "./github-workspace";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("generates correct branch name with shortTaskId and slug", () => {
  expect(slugify("Route Fix for Auth API")).toBe("route-fix-for-auth-api");
  expect(slugify("Çok Özel Türkçe Karakterler")).toBe(
    "cok-ozel-turkce-karakterler",
  );

  const taskId = "d52fda24-1234-4567-89ab-cdef01234567";
  const branch = generateCodingBranchName(taskId, "Route Fix for Auth API");
  expect(branch).toBe("agent/task-d52fda24-route-fix-for-auth-api");
});

it("enforces main branch protection and rejects direct target", () => {
  expect(() => assertProtectedBranch("main", "main")).toThrow(
    "protected_branch_violation",
  );
  expect(() => assertProtectedBranch("master", "master")).toThrow(
    "protected_branch_violation",
  );
  expect(() => assertProtectedBranch("production", "main")).toThrow(
    "protected_branch_violation",
  );
  expect(() => assertProtectedBranch("feature/direct", "main")).toThrow(
    "invalid_branch_format",
  );
  expect(() =>
    assertProtectedBranch("agent/task-d52fda24-fix", "main"),
  ).not.toThrow();
});

it("resolves default base branch commit SHA safely", () => {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/repos/owner/repo/git/ref/heads/main")) {
      return new Response(
        JSON.stringify({ object: { sha: "abc1234567890" } }),
        { status: 200 },
      );
    }
    if (url.includes("/repos/owner/repo")) {
      return new Response(JSON.stringify({ default_branch: "main" }), {
        status: 200,
      });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);

  return resolveBaseBranch("owner", "repo").then((res) => {
    expect(res).toEqual({ branch: "main", sha: "abc1234567890" });
  });
});

it("throws repository_not_found for invalid repo", async () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetchMock);

  await expect(resolveBaseBranch("owner", "nonexistent")).rejects.toThrow(
    "repository_not_found",
  );
});

it("checks branch existence correctly", async () => {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("existing-branch")) {
      return new Response(
        JSON.stringify({ ref: "refs/heads/existing-branch" }),
        {
          status: 200,
        },
      );
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);

  expect(await checkBranchExists("owner", "repo", "existing-branch")).toBe(
    true,
  );
  expect(await checkBranchExists("owner", "repo", "new-branch")).toBe(false);
});

it("creates temporary coding branch with mock GitHub API", async () => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/git/ref/heads/agent/task-12345678-fix")) {
      return new Response(null, { status: 404 });
    }
    if (url.includes("/git/refs") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      expect(body.ref).toBe("refs/heads/agent/task-12345678-fix");
      expect(body.sha).toBe("base-sha-123");
      return new Response(
        JSON.stringify({
          ref: body.ref,
          object: { sha: "created-sha-999" },
        }),
        { status: 201 },
      );
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);

  const res = await createCodingBranch(
    "owner",
    "repo",
    "agent/task-12345678-fix",
    "base-sha-123",
  );

  expect(res).toEqual({
    branch: "agent/task-12345678-fix",
    sha: "created-sha-999",
    created: true,
  });
});

it("reads file from branch content correctly", async () => {
  const fileContent = "const x = 1;";
  const encoded = Buffer.from(fileContent).toString("base64");
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/contents/src/index.ts")) {
      return new Response(
        JSON.stringify({
          content: encoded,
          encoding: "base64",
          sha: "blob-sha-111",
        }),
        { status: 200 },
      );
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);

  const result = await readFileFromBranch(
    "owner",
    "repo",
    "agent/task-123",
    "src/index.ts",
  );
  expect(result).toEqual({ content: fileContent, sha: "blob-sha-111" });

  const missing = await readFileFromBranch(
    "owner",
    "repo",
    "agent/task-123",
    "missing.ts",
  );
  expect(missing).toBeNull();
});

it("creates branch commit atomically using git data api", async () => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    // 1. Get branch commit
    if (
      url.includes("/git/ref/heads/agent%2Ftask-123") ||
      url.includes("/git/ref/heads/agent/task-123")
    ) {
      return new Response(
        JSON.stringify({ object: { sha: "latest-branch-sha" } }),
        { status: 200 },
      );
    }
    // 2. Get commit details for tree
    if (url.includes("/git/commits/latest-branch-sha")) {
      return new Response(JSON.stringify({ tree: { sha: "base-tree-sha" } }), {
        status: 200,
      });
    }
    // 3. Post tree
    if (url.includes("/git/trees") && init?.method === "POST") {
      return new Response(JSON.stringify({ sha: "new-tree-sha" }), {
        status: 201,
      });
    }
    // 4. Post commit
    if (url.includes("/git/commits") && init?.method === "POST") {
      return new Response(JSON.stringify({ sha: "new-commit-sha" }), {
        status: 201,
      });
    }
    // 5. Patch branch ref
    if (
      url.includes("/git/refs/heads/agent%2Ftask-123") ||
      url.includes("/git/refs/heads/agent/task-123")
    ) {
      return new Response(
        JSON.stringify({
          ref: "refs/heads/agent/task-123",
          object: { sha: "new-commit-sha" },
        }),
        { status: 200 },
      );
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);

  const res = await createBranchCommit({
    owner: "owner",
    repo: "repo",
    branch: "agent/task-123",
    commitMessage: "test: commit",
    changes: [{ path: "src/test.ts", content: "console.log('hi');" }],
  });

  expect(res.commitSha).toBe("new-commit-sha");
  expect(res.branch).toBe("agent/task-123");
  expect(res.treeSha).toBe("new-tree-sha");
});

it("detects branch conflict (422) on ref update", async () => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/git/ref/heads/") || url.includes("/git/refs/heads/")) {
      if (init?.method === "PATCH") {
        return new Response(
          JSON.stringify({ message: "Update is not a fast forward" }),
          { status: 422 },
        );
      }
      return new Response(JSON.stringify({ object: { sha: "head-sha" } }), {
        status: 200,
      });
    }
    if (url.includes("/git/commits/head-sha")) {
      return new Response(JSON.stringify({ tree: { sha: "tree-sha" } }), {
        status: 200,
      });
    }
    if (url.includes("/git/trees")) {
      return new Response(JSON.stringify({ sha: "new-tree-sha" }), {
        status: 201,
      });
    }
    if (url.includes("/git/commits")) {
      return new Response(JSON.stringify({ sha: "new-commit-sha" }), {
        status: 201,
      });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);

  await expect(
    createBranchCommit({
      owner: "owner",
      repo: "repo",
      branch: "agent/task-123",
      commitMessage: "conflict test",
      changes: [{ path: "file.txt", content: "hello" }],
    }),
  ).rejects.toThrow("coding_conflict");
});
