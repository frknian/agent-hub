import { z } from "zod";
export const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => /^postgres(ql)?:/.test(v), "Expected PostgreSQL URL"),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  OWNER_GITHUB_ID: z.string().regex(/^\d+$/).optional(),
  SEED_GITHUB_ID: z.string().regex(/^\d+$/).optional(),
});
