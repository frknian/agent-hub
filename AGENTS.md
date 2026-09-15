# Agent rules

- Preserve the App Router, service layer, Drizzle schema, and owner-scoped authentication architecture.
- Inspect relevant files before changing code. Prefer minimal changes; never rewrite unrelated functionality.
- Never expose secrets or tokens, commit environment files, or request GitHub repository write scopes.
- Validate all server input with Zod. Authenticate mutations and queries and scope private data to the current user.
- Keep this milestone limited to projects and queued tasks; no agent execution, repository editing, or billing.
- Run `npm run lint`, `npm run typecheck`, and `npm test` after changes. Run `npm run build` before considering a task complete.
- Keep migrations and documentation current. Never directly modify production systems or run migrations against production without explicit authorization.
