# Agent rules

- Preserve the App Router, service layer, Drizzle schema, and owner-scoped authentication architecture.
- Inspect relevant files before changing code. Prefer minimal changes; never rewrite unrelated functionality.
- Never expose secrets or tokens, commit environment files, or request GitHub repository write scopes.
- Validate all server input with Zod. Authenticate mutations and queries and scope private data to the current user.
- Keep this milestone limited to projects and queued tasks; no agent execution, repository editing, or billing.
- Run `npm run lint`, `npm run typecheck`, and `npm test` after changes. Run `npm run build` before considering a task complete.
- Keep migrations and documentation current. Never directly modify production systems or run migrations against production without explicit authorization.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
