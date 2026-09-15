import "server-only";

const ignored =
  /(^|\/)(node_modules|build|dist|\.next|vendor|Pods|DerivedData|\.git|\.gradle)(\/|$)/;
const binary =
  /\.(png|jpe?g|gif|webp|pdf|zip|gz|lock|ico|woff2?|mp4|mov|avi|mp3|wav|tar|tgz|exe|dll|dylib|so)$/i;

export type RepoFile = { path: string; size: number; content: string };

export type ReadRepositoryOptions = {
  preferredPaths?: string[];
  maxFiles?: number;
  token?: string;
};

export type RepositoryReadResult = {
  owner: string;
  repo: string;
  branch: string;
  treeCount: number;
  allFilePaths: string[];
  files: RepoFile[];
};

export function parsePublicRepository(url: string) {
  const match = new URL(url).pathname.match(/^\/([\w-]+)\/([\w.-]+)\/?$/);
  if (!match) throw new Error("repository_not_found");
  return { owner: match[1], repo: match[2].replace(/\.git$/i, "") };
}

async function github(path: string, token?: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "agent-hub",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`https://api.github.com${path}`, {
    headers,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (response.status === 404) throw new Error("repository_not_found");
  if (!response.ok) throw new Error("github_access_error");
  return response.json();
}

export function extractQueryTerms(query: string): string[] {
  const rawTerms = query.toLowerCase().match(/[a-z0-9_./-]{3,}/g) ?? [];
  const expanded = new Set<string>(rawTerms);
  for (const t of rawTerms) {
    if (t.includes("rota")) expanded.add("route");
    if (t.includes("harita")) expanded.add("map");
    if (t.includes("takip")) expanded.add("track");
    if (t.includes("aktivite")) expanded.add("activity");
  }
  return Array.from(expanded);
}

export function scoreFileCandidate(
  path: string,
  terms: string[],
  preferredPaths: Set<string>,
): number {
  let score = 0;

  // 1. Analyst's verified relevant files get highest priority
  if (preferredPaths.has(path)) {
    score += 1000;
  }

  // 2. Keyword match against path segments
  const lowerPath = path.toLowerCase();
  for (const term of terms) {
    if (term.length >= 3 && lowerPath.includes(term)) {
      score += 25;
    }
  }

  // 3. Source code extensions priority
  const sourceCodeRegex = /\.(tsx?|jsx?|kt|kts|swift|java|py|go|rs)$/i;
  const styleOrMarkupRegex = /\.(css|scss|vue|html)$/i;
  const configOrDataRegex = /\.(json|ya?ml)$/i;

  if (sourceCodeRegex.test(path)) {
    score += 50;
  } else if (styleOrMarkupRegex.test(path)) {
    score += 30;
  } else if (configOrDataRegex.test(path)) {
    score += 10;
  }

  // 4. Primary application directories
  if (
    /^(src|app|components|lib|services|routes|utils|features|hooks)\//i.test(
      path,
    )
  ) {
    score += 30;
  }

  // 5. Demote low-priority / docs / config / dotfiles
  if (
    /(^|\/)(\.env(\..+)?|\.gitignore|README\.md|LICENSE.*)/i.test(path) ||
    /\.(xcconfig|md)$/i.test(path)
  ) {
    score -= 100;
  }
  if (/^docs\//i.test(path)) {
    score -= 80;
  }
  if (/^(tests?|__tests__|scripts)\//i.test(path)) {
    score -= 40;
  }

  return score;
}

export async function readRepository(
  url: string,
  query: string,
  options?: ReadRepositoryOptions,
): Promise<RepositoryReadResult> {
  const { owner, repo } = parsePublicRepository(url);
  const meta = (await github(`/repos/${owner}/${repo}`, options?.token)) as {
    default_branch: string;
  };
  const tree = (await github(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`,
    options?.token,
  )) as { tree: { path: string; type: string; size?: number }[] };

  const validBlobs = tree.tree.filter(
    (file) =>
      file.type === "blob" &&
      !ignored.test(file.path) &&
      !binary.test(file.path),
  );

  const allFilePaths = validBlobs.map((f) => f.path);

  const terms = extractQueryTerms(query);
  const preferredSet = new Set(
    (options?.preferredPaths ?? []).map((p) => p.trim().replace(/^\.\//, "")),
  );

  const candidates = validBlobs
    .filter((file) => (file.size ?? 0) <= 48_000)
    .sort((a, b) => {
      const scoreA = scoreFileCandidate(a.path, terms, preferredSet);
      const scoreB = scoreFileCandidate(b.path, terms, preferredSet);
      return scoreB - scoreA;
    })
    .slice(0, options?.maxFiles ?? 8);

  let total = 0;
  const files: RepoFile[] = [];
  for (const file of candidates) {
    const data = (await github(
      `/repos/${owner}/${repo}/contents/${file.path}?ref=${encodeURIComponent(meta.default_branch)}`,
      options?.token,
    )) as { content?: string; encoding?: string };
    const content =
      data.encoding === "base64" && data.content
        ? Buffer.from(data.content, "base64").toString("utf8")
        : "";
    if (content && total + content.length <= 120_000) {
      total += content.length;
      files.push({ path: file.path, size: content.length, content });
    }
  }

  return {
    owner,
    repo,
    branch: meta.default_branch,
    treeCount: tree.tree.length,
    allFilePaths,
    files,
  };
}
