import { z } from "zod";
export const taskStatuses = [
  "queued",
  "planning",
  "running",
  "reviewing",
  "testing",
  "waiting_approval",
  "completed",
  "failed",
] as const;
export function parseRepository(value: string) {
  const url = new URL(value);
  const match = url.pathname.match(/^\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/?$/);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !match
  )
    throw new Error("Geçerli bir GitHub depo URL'si girin.");
  const owner = match[1],
    name = match[2].replace(/\.git$/i, "");
  if (!name || name === "." || name === "..")
    throw new Error("Geçersiz depo adı.");
  return {
    repositoryOwner: owner,
    repositoryName: name,
    repositoryUrl: `https://github.com/${owner}/${name}`,
  };
}
export const projectInput = z.object({
  name: z.string().trim().min(1, "Proje adı gerekli.").max(100),
  repositoryUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => {
      try {
        parseRepository(v);
        return true;
      } catch {
        return false;
      }
    }, "https://github.com/sahip/depo biçimini kullanın."),
});
export const taskInput = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, "Görev başlığı gerekli.").max(200),
  description: z.string().trim().max(10000),
});
export const idInput = z.string().uuid();
