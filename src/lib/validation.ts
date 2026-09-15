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

export const providerIds = ["qwen", "kimi", "openai"] as const;
export const agentRoles = [
  "primary",
  "reviewer",
  "fallback",
  "premium",
] as const;
export const providerCredentialInput = z
  .object({
    provider: z.enum(providerIds),
    apiKey: z
      .string()
      .trim()
      .min(8, "Geçerli bir API anahtarı girin.")
      .max(1000),
    baseUrl: z
      .string()
      .trim()
      .url("Geçerli bir HTTPS API host girin.")
      .max(500)
      .optional()
      .or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.provider === "qwen" && !v.baseUrl)
      ctx.addIssue({
        code: "custom",
        path: ["baseUrl"],
        message: "Qwen için API Host gerekli.",
      });
  });
export const agentSystemInput = z
  .object({
    mode: z.enum(["preset", "custom"]),
    premiumApproval: z.enum(["manual", "disabled"]),
    roles: z
      .array(
        z.object({
          role: z.enum(agentRoles),
          provider: z.enum(providerIds),
          model: z.string().trim().min(1).max(160),
        }),
      )
      .length(4),
  })
  .superRefine((value, ctx) => {
    if (
      new Set(value.roles.map((role) => role.role)).size !== agentRoles.length
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Her agent rolü bir kez yapılandırılmalıdır.",
      });
    }
  });
