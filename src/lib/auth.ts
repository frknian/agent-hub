import "server-only";
import { cache } from "react";
import { getServerSession, type NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getEnv } from "@/config/env";
export function authOptions(): NextAuthOptions {
  const env = getEnv();
  return {
    secret: env.NEXTAUTH_SECRET,
    logger: {
      error() {
        console.error("Authentication failed");
      },
      warn() {
        console.warn("Authentication configuration warning");
      },
      debug() {},
    },
    session: { strategy: "jwt", maxAge: 86400 },
    pages: { signIn: "/login", error: "/login" },
    providers: [
      GitHubProvider({
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        authorization: { params: { scope: "read:user" } },
      }),
    ],
    callbacks: {
      async signIn({ profile }) {
        const p = z
          .object({
            id: z.number().int().positive(),
            login: z.string().min(1),
            avatar_url: z.string().url().optional(),
          })
          .safeParse(profile);
        if (
          !p.success ||
          (env.OWNER_GITHUB_ID && String(p.data.id) !== env.OWNER_GITHUB_ID)
        )
          return false;
        await getDb()
          .insert(users)
          .values({
            githubId: String(p.data.id),
            username: p.data.login,
            avatarUrl: p.data.avatar_url,
          })
          .onConflictDoUpdate({
            target: users.githubId,
            set: { username: p.data.login, avatarUrl: p.data.avatar_url },
          });
        return true;
      },
      async jwt({ token, account }) {
        if (account) {
          const [user] = await getDb()
            .select({ id: users.id })
            .from(users)
            .where(eq(users.githubId, account.providerAccountId))
            .limit(1);
          if (!user) throw new Error("User unavailable");
          token.userId = user.id;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user && typeof token.userId === "string")
          session.user.id = token.userId;
        return session;
      },
    },
  };
}
export const requireUser = cache(async function requireUser() {
  const session = await getServerSession(authOptions());
  if (!session?.user?.id) redirect("/login");
  return session.user;
});
