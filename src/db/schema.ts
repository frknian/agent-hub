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
