# Agent Hub — Milestone 1

Users sign in with GitHub, manually add a GitHub project, open that project, and create a task. The task is persisted with status `queued` and appears immediately in the dashboard and task list.
The interface is Turkish, responsive, light, and installable. Dashboard metrics include active tasks (all nonterminal states), completed tasks, project count, and an explicitly unavailable AI cost.
Projects, tasks, dashboard, agents, costs, and settings are protected. Empty, loading, validation, duplicate repository, and error states are supported.
Out of scope: AI models, execution infrastructure, repository modification or importing, automated coding, billing, and deployment permissions.
Acceptance: lint, strict typecheck, tests, migration consistency, production build, and owner isolation checks pass. Live OAuth and database verification require configured development resources.
