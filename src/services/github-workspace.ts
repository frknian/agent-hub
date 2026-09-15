import "server-only";

export function slugify(text: string): string {
  const trMap: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    Ç: "c",
    Ğ: "g",
    İ: "i",
    I: "i",
    Ö: "o",
    Ş: "s",
    Ü: "u",
  };
  const normalized = text.replace(/[çğışöüÇĞIİÖŞÜ]/g, (c) => trMap[c] ?? c);
  return normalized
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "");
}

export function generateCodingBranchName(
  taskId: string,
  title: string,
): string {
  const shortId = taskId.replace(/-/g, "").slice(0, 8);
  const slug = slugify(title) || "task";
  return `agent/task-${shortId}-${slug}`;
}

export function assertProtectedBranch(
  branchName: string,
  defaultBranch: string,
): void {
  const normalized = branchName.trim().toLowerCase();
  const normalizedDefault = defaultBranch.trim().toLowerCase();

  if (normalized === normalizedDefault) {
    throw new Error(
      "protected_branch_violation: Cannot target default branch directly",
    );
  }

  const forbidden = ["main", "master", "develop", "production", "release"];
  if (
    forbidden.includes(normalized) ||
    forbidden.includes(normalized.replace(/^refs\/heads\//, ""))
  ) {
    throw new Error("protected_branch_violation: Target branch is protected");
  }

  if (!normalized.startsWith("agent/")) {
    throw new Error(
      "invalid_branch_format: Coding branch must start with agent/",
    );
  }
}

async function githubApi(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
  } = {},
) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "agent-hub",
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`https://api.github.com${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  return response;
}

export async function resolveBaseBranch(
  owner: string,
  repo: string,
  token?: string | null,
): Promise<{ branch: string; sha: string }> {
  const repoRes = await githubApi(`/repos/${owner}/${repo}`, { token });
  if (repoRes.status === 404) throw new Error("repository_not_found");
  if (!repoRes.ok) throw new Error("github_access_error");

  const repoData = (await repoRes.json()) as { default_branch?: string };
  const defaultBranch = repoData.default_branch || "main";

  const refRes = await githubApi(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
    { token },
  );
  if (!refRes.ok) {
    // Fallback commit check
    const commitRes = await githubApi(
      `/repos/${owner}/${repo}/commits/${encodeURIComponent(defaultBranch)}`,
      { token },
    );
    if (!commitRes.ok) throw new Error("base_branch_not_found");
    const commitData = (await commitRes.json()) as { sha: string };
    return { branch: defaultBranch, sha: commitData.sha };
  }

  const refData = (await refRes.json()) as { object?: { sha: string } };
  if (!refData.object?.sha) throw new Error("base_branch_not_found");

  return { branch: defaultBranch, sha: refData.object.sha };
}

export async function checkBranchExists(
  owner: string,
  repo: string,
  branchName: string,
  token?: string | null,
): Promise<boolean> {
  const cleanBranch = branchName.replace(/^refs\/heads\//, "");
  const res = await githubApi(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(cleanBranch)}`,
    { token },
  );
  return res.status === 200;
}

export async function createCodingBranch(
  owner: string,
  repo: string,
  branchName: string,
  baseSha: string,
  token?: string | null,
): Promise<{ branch: string; sha: string; created: boolean }> {
  assertProtectedBranch(branchName, "main");

  const cleanBranch = branchName.replace(/^refs\/heads\//, "");
  const exists = await checkBranchExists(owner, repo, cleanBranch, token);
  if (exists) {
    return { branch: cleanBranch, sha: baseSha, created: false };
  }

  const res = await githubApi(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: {
      ref: `refs/heads/${cleanBranch}`,
      sha: baseSha,
    },
    token,
  });

  if (res.status === 201) {
    const data = (await res.json()) as { object?: { sha?: string } };
    return {
      branch: cleanBranch,
      sha: data.object?.sha ?? baseSha,
      created: true,
    };
  }

  if (res.status === 422) {
    return { branch: cleanBranch, sha: baseSha, created: false };
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("github_write_permission_denied");
  }

  throw new Error("branch_creation_failed");
}

export async function readFileFromBranch(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  token?: string | null,
): Promise<{ content: string; sha: string } | null> {
  const cleanBranch = branch.replace(/^refs\/heads\//, "");
  const res = await githubApi(
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(cleanBranch)}`,
    { token },
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error("github_access_error");

  const data = (await res.json()) as {
    content?: string;
    encoding?: string;
    sha: string;
  };
  const content =
    data.encoding === "base64" && data.content
      ? Buffer.from(data.content, "base64").toString("utf8")
      : "";

  return { content, sha: data.sha };
}

export async function createBranchCommit(options: {
  owner: string;
  repo: string;
  branch: string;
  commitMessage: string;
  changes: { path: string; content: string }[];
  token?: string | null;
}): Promise<{ commitSha: string; branch: string; treeSha: string }> {
  assertProtectedBranch(options.branch, "main");

  const cleanBranch = options.branch.replace(/^refs\/heads\//, "");

  // 1. Get latest commit of the branch
  const refRes = await githubApi(
    `/repos/${options.owner}/${options.repo}/git/ref/heads/${encodeURIComponent(cleanBranch)}`,
    { token: options.token },
  );
  if (!refRes.ok) throw new Error("branch_not_found");
  const refData = (await refRes.json()) as { object?: { sha?: string } };
  const latestCommitSha = refData.object?.sha;
  if (!latestCommitSha) throw new Error("branch_commit_not_found");

  // 2. Get base tree SHA from latest commit
  const commitRes = await githubApi(
    `/repos/${options.owner}/${options.repo}/git/commits/${latestCommitSha}`,
    { token: options.token },
  );
  if (!commitRes.ok) throw new Error("commit_lookup_failed");
  const commitData = (await commitRes.json()) as { tree?: { sha?: string } };
  const baseTreeSha = commitData.tree?.sha;

  // 3. Create new tree with changed files
  const treeItems = options.changes.map((change) => ({
    path: change.path,
    mode: "100644",
    type: "blob",
    content: change.content,
  }));

  const treeRes = await githubApi(
    `/repos/${options.owner}/${options.repo}/git/trees`,
    {
      method: "POST",
      body: {
        base_tree: baseTreeSha,
        tree: treeItems,
      },
      token: options.token,
    },
  );

  if (treeRes.status === 401 || treeRes.status === 403) {
    throw new Error("github_write_permission_denied");
  }
  if (!treeRes.ok) throw new Error("tree_creation_failed");
  const treeData = (await treeRes.json()) as { sha: string };
  const newTreeSha = treeData.sha;

  // 4. Create commit
  const newCommitRes = await githubApi(
    `/repos/${options.owner}/${options.repo}/git/commits`,
    {
      method: "POST",
      body: {
        message: options.commitMessage,
        tree: newTreeSha,
        parents: [latestCommitSha],
      },
      token: options.token,
    },
  );

  if (!newCommitRes.ok) throw new Error("commit_creation_failed");
  const newCommitData = (await newCommitRes.json()) as { sha: string };
  const newCommitSha = newCommitData.sha;

  // 5. Update branch reference (optimistic concurrency, force: false)
  const updateRefRes = await githubApi(
    `/repos/${options.owner}/${options.repo}/git/refs/heads/${encodeURIComponent(cleanBranch)}`,
    {
      method: "PATCH",
      body: {
        sha: newCommitSha,
        force: false,
      },
      token: options.token,
    },
  );

  if (updateRefRes.status === 422) {
    throw new Error(
      "coding_conflict: Branch has moved since execution started",
    );
  }
  if (!updateRefRes.ok) throw new Error("branch_update_failed");

  return {
    commitSha: newCommitSha,
    branch: cleanBranch,
    treeSha: newTreeSha,
  };
}
