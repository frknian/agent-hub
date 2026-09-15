import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { taskStatuses } from "../lib/validation";
export const taskStatus = pgEnum("task_status", taskStatuses);
export const providerType = pgEnum("provider_type", ["qwen", "kimi", "openai"]);
export const credentialStatus = pgEnum("credential_status", [
  "untested",
  "connected",
  "error",
]);
export const agentSystemMode = pgEnum("agent_system_mode", [
  "preset",
  "custom",
]);
export const approvalMode = pgEnum("approval_mode", ["manual", "disabled"]);
export const agentRole = pgEnum("agent_role", [
  "primary",
  "reviewer",
  "fallback",
  "premium",
]);
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: text("github_id").notNull().unique(),
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    repositoryUrl: text("repository_url").notNull(),
    repositoryOwner: text("repository_owner").notNull(),
    repositoryName: text("repository_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("projects_user_idx").on(t.userId),
    uniqueIndex("projects_user_repo_idx").on(t.userId, t.repositoryUrl),
  ],
);
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: taskStatus("status").notNull().default("queued"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tasks_project_idx").on(t.projectId),
    index("tasks_created_idx").on(t.createdAt),
  ],
);

export const providerCredentials = pgTable(
  "provider_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: providerType("provider").notNull(),
    encryptedApiKey: text("encrypted_api_key").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    keyHint: text("key_hint").notNull(),
    status: credentialStatus("status").notNull().default("untested"),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("provider_credentials_user_idx").on(t.userId),
    uniqueIndex("provider_credentials_user_provider_idx").on(
      t.userId,
      t.provider,
    ),
  ],
);

export const agentSystems = pgTable(
  "agent_systems",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: agentSystemMode("mode").notNull().default("preset"),
    presetId: text("preset_id"),
    premiumApproval: approvalMode("premium_approval")
      .notNull()
      .default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("agent_systems_user_idx").on(t.userId)],
);

export const agentRoleConfigs = pgTable(
  "agent_role_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    systemId: uuid("system_id")
      .notNull()
      .references(() => agentSystems.id, { onDelete: "cascade" }),
    role: agentRole("role").notNull(),
    provider: providerType("provider").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("agent_role_configs_system_role_idx").on(t.systemId, t.role),
  ],
);
