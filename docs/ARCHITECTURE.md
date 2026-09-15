# Architecture

Next.js App Router with TypeScript strict mode; server components load private data. Small client components handle forms with React action state, navigation, authentication buttons, and service worker registration. Tailwind and owned shadcn components provide the interface.
Server actions authenticate with NextAuth, validate Zod input, call services, and revalidate the workspace. Services use Drizzle parameterized SQL with Neon HTTP; each read and task creation checks project ownership. No browser database client or secret configuration is exported.
GitHub OAuth uses encrypted JWT sessions with a one-day lifetime and persists the internal user UUID in the session. OAuth profile upsert uses immutable numeric GitHub ID; tokens are not stored. Optional OWNER_GITHUB_ID restricts admission while ownership remains multi-user compatible.
Database: users → projects → tasks via UUID foreign keys with cascading deletion. GitHub IDs are unique. Repository URL uniqueness is scoped per user. Timestamps are timezone-aware; future updates must explicitly set updated_at. Task status is a PostgreSQL enum with queued default. Drizzle-generated SQL migrations are committed; deployment never automatically runs them.
PWA uses a manifest, PNG icons, and a small service worker. Navigations always go to the network; disconnected requests show a generic offline page. Private responses, session routes, and task data are never cached by the worker. Offline task creation is intentionally unsupported.
Appearance uses shared Tailwind CSS tokens with light and dark values. A small client ThemeProvider persists the explicit light, dark, or system preference in localStorage and observes operating-system changes for the system option. An inline document-head script applies the resolved class and browser theme color before hydration, preventing an incorrect-theme flash. The header and settings screen use the same accessible three-option switcher.
Builds do not require live database credentials: environment validation is lazy at private request handling. Protected routes are dynamic. Use the Node runtime and Vercel-compatible Next.js defaults.

BYOK credentials are isolated by user in `provider_credentials`; ciphertext, IV, and GCM authentication tag are server-only. `agent_systems` holds one owner-scoped routing profile and `agent_role_configs` stores its primary, reviewer, fallback, and premium routes. Provider adapters expose connection testing, model listing, and server-only completion interfaces.

## Milestone 2C reviewer

After a validated Qwen primary run is persisted as completed, the configured Kimi reviewer runs once in a separate owner-scoped `task_runs` record (`agent_role = reviewer`). Review events carry only the primary run UUID as linkage metadata. The existing schema is sufficient; no migration is required. The reviewer receives task text, the validated Qwen analysis, public repository identifiers and capped excerpts of Qwen-selected files already collected by the primary run (8 files, 4,000 characters per file, 24,000 total). Missing files are explicitly reported to the reviewer. It does not fetch the repository again.

Kimi uses OpenAI-compatible JSON mode with a separate review schema and instant mode. Review verdict is approve, needs_revision or insufficient_context. Invalid output and missing credentials fail only the reviewer run; the primary result and completed task remain intact. Polling includes active reviewer runs, and the task page presents both results independently. GPT escalation is not enabled.

## Milestone 3A cloud coding foundation

Cloud coding foundation establishes isolated workspace execution without modifying repository files or touching base branches directly.

- **Branch format & protection:** All agent coding runs strictly target `agent/task-{shortTaskId}-{slug}` (e.g. `agent/task-d52fda24-route-fix`). The agent is fundamentally barred from targeting or mutating the default branch (`main`/`master`) directly.
- **Approval policy:** The agent never pushes directly to default branches, never performs force pushes, never deletes branches, and never performs destructive migrations.
- **Least privilege GitHub permissions:** Repository write foundation requires minimum permissions: `Contents: Read and write` (to manage refs and coding branches) and `Metadata: Read-only`. `Administration`, `Workflows`, and `Secrets` permissions are explicitly forbidden.
- **Data model & events:** Runs are persisted as owner-scoped `task_runs` records with `agent_role = "coding"`. Event progression follows: `coding_requested` → `repository_write_access_validated` → `base_branch_resolved` → `coding_branch_created` → `coding_workspace_ready`. Primary Qwen analysis and Kimi review data remain completely isolated and intact.
- **Scope limitation:** This milestone establishes only the branch and isolated workspace foundation. File modifications, code generation, patches, test runners, commits, pushes, pull requests, and automated escalation are strictly deferred to future milestones.
