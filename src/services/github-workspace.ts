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
