import { afterEach, expect, it, vi } from "vitest";
import {
  generateCodingBranchName,
  assertProtectedBranch,
  resolveBaseBranch,
  checkBranchExists,
  createCodingBranch,
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
