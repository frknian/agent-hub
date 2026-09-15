import "server-only";

const ignored = /(^|\/)(node_modules|build|dist|\.next|vendor|Pods|DerivedData|\.git|\.gradle)(\/|$)/;
const binary = /\.(png|jpe?g|gif|webp|pdf|zip|gz|lock|ico|woff2?)$/i;
export type RepoFile = { path: string; size: number; content: string };

export function parsePublicRepository(url: string) {
  const match = new URL(url).pathname.match(/^\/([\w-]+)\/([\w.-]+)\/?$/);
  if (!match) throw new Error("repository_not_found");
  return { owner: match[1], repo: match[2].replace(/\.git$/i, "") };
}

async function github(path: string) {
  const response = await fetch(`https://api.github.com${path}`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "agent-hub" }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (response.status === 404) throw new Error("repository_not_found");
  if (!response.ok) throw new Error("github_access_error");
  return response.json();
}

export async function readRepository(url: string, query: string) {
  const { owner, repo } = parsePublicRepository(url);
  const meta = (await github(`/repos/${owner}/${repo}`)) as { default_branch: string };
  const tree = (await github(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`)) as { tree: { path: string; type: string; size?: number }[] };
  const terms = query.toLowerCase().match(/[a-z0-9_./-]{3,}/g) ?? [];
  const candidates = tree.tree.filter((file) => file.type === "blob" && !ignored.test(file.path) && !binary.test(file.path) && (file.size ?? 0) <= 48_000).sort((a, b) => {
    const score = (path: string) => terms.some((term) => path.toLowerCase().includes(term)) ? 1 : 0;
    return score(b.path) - score(a.path);
  }).slice(0, 8);
  let total = 0;
  const files: RepoFile[] = [];
  for (const file of candidates) {
    const data = (await github(`/repos/${owner}/${repo}/contents/${file.path}?ref=${encodeURIComponent(meta.default_branch)}`)) as { content?: string; encoding?: string };
    const content = data.encoding === "base64" && data.content ? Buffer.from(data.content, "base64").toString("utf8") : "";
    if (content && total + content.length <= 120_000) { total += content.length; files.push({ path: file.path, size: content.length, content }); }
  }
  return { owner, repo, branch: meta.default_branch, treeCount: tree.tree.length, files };
}
