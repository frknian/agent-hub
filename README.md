# Agent Hub

Milestone 1: GitHub sign-in → project → persisted queued task → dashboard status. Next.js App Router, strict TypeScript, Tailwind, shadcn/ui, Neon PostgreSQL, Drizzle, NextAuth GitHub OAuth, Zod, and Vitest. No AI execution or repository write access.

## Local setup

Requires Node.js 22.12+ and npm. Install with `npm ci`. Copy `.env.example` to `.env.local` and configure:

- `DATABASE_URL`: a development Neon PostgreSQL connection string with SSL.
- `NEXTAUTH_URL`: `http://localhost:3000` locally; your HTTPS origin when hosting.
- `NEXTAUTH_SECRET`: at least 32 characters; generate with `openssl rand -base64 32`.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: a GitHub OAuth App with homepage `http://localhost:3000` and callback `http://localhost:3000/api/auth/callback/github`. Use a separate OAuth App and exact callback for production.
- `OWNER_GITHUB_ID` (optional): your numeric GitHub ID to restrict sign-in to one owner. Omit to allow multiple independently scoped users.
- `SEED_GITHUB_ID` (development only): your numeric GitHub ID for seed data.

Run `npm run db:migrate` against your development database, then `npm run dev`. Sign in, add a repository URL, open the project, and create a task. The task appears as Sırada on the dashboard. GitHub URLs are stored only, with no repository access.

## Neon setup

This repository is linked locally with the Neon CLI. The local link metadata and generated database connection variables remain outside source control.

```bash
neon login
neon link --project-id <project-id> --branch production -y
neon config init
npm run db:migrate
neon deploy
```

`neon config init` creates `neon.ts`, which is committed as the project's Neon policy. The local `.env.local` created by the CLI is ignored by Git. Do not copy its values into source files, documentation, or commits.

## Development seed

After your first sign-in, set `SEED_GITHUB_ID` and run `npm run db:seed`. Adds Hedefit, Planorth, Makul, Pişsin, and Ritim plus the GPS sample task. URLs are sample references, not claims that those repositories exist. Reruns skip existing repositories. Never run the seed against a production database.

## Checks and migrations

```
npm run db:generate
npm run db:check
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

`db:generate` creates reviewed migrations; `db:check` checks migration consistency without connecting. `db:migrate` applies committed migrations and requires configured credentials. Builds need no secrets or live database. Private requests fail closed if configuration is missing. Do not use schema push as a production migration strategy.

## PWA and hosting

Use `npm run build` and `npm start` to test service worker behavior locally. Install via the browser install action on Android/desktop; on iPhone use Share → Add to Home Screen. HTTPS is required outside localhost. Offline shows a generic connectivity page; private data and forms require a connection.

Vercel-compatible with standard Next.js defaults. Add `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET` in the Vercel project settings; these values must never be committed. Apply reviewed migrations separately before enabling the production application.

## Structure

`src/app` routes/actions; `src/components` responsive UI and owned shadcn primitives; `src/services` owner-scoped operations; `src/db` schema/client/seed; `src/config` server environment validation; `src/lib` auth and input rules; `drizzle` committed migrations; `docs` product, architecture, security, and roadmap.

# agent-hub
