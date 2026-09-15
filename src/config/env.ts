import "server-only";
import { envSchema } from "./env-schema";
export function getEnv() {
  const result = envSchema.safeParse({
    ...process.env,
    OWNER_GITHUB_ID: process.env.OWNER_GITHUB_ID || undefined,
  });
  if (!result.success)
    throw new Error(
      `Invalid server configuration: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  return result.data;
}
