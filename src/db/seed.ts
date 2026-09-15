import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { users, projects, tasks } from "./schema";
config({ path: ".env.local" });
config();
if (
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production"
)
  throw new Error("Development seed is disabled in production");
const env = z
  .object({
    DATABASE_URL: z.string().url(),
    SEED_GITHUB_ID: z.string().regex(/^\d+$/),
  })
  .parse(process.env);
const db = drizzle(neon(env.DATABASE_URL));
const [user] = await db
  .select()
  .from(users)
  .where(eq(users.githubId, env.SEED_GITHUB_ID));
if (!user)
  throw new Error(
    "Sign in first, then set SEED_GITHUB_ID to your GitHub numeric ID",
  );
for (const name of ["Hedefit", "Planorth", "Makul", "Pişsin", "Ritim"]) {
  const repo = name === "Pişsin" ? "pissin" : name.toLowerCase();
  const [project] = await db
    .insert(projects)
    .values({
      userId: user.id,
      name,
      repositoryOwner: user.username,
      repositoryName: repo,
      repositoryUrl: `https://github.com/${user.username}/${repo}`,
    })
    .onConflictDoNothing()
    .returning();
  if (project && name === "Hedefit")
    await db.insert(tasks).values({
      projectId: project.id,
      title: "Rota navigasyonundaki GPS doğruluk problemini düzelt.",
      description: "Kullanıcı hareket ederken marker konumu sıçrıyor.",
      status: "queued",
    });
}
console.info("Development seed complete");
