import { describe, it, expect } from "vitest";
import {
  parseRepository,
  projectInput,
  taskInput,
  taskStatuses,
} from "./validation";
import { envSchema } from "@/config/env-schema";
describe("repository input", () => {
  it("normalizes GitHub URLs without accessing repositories", () => {
    expect(
      parseRepository("https://github.com/frknian/agent-hub.git/"),
    ).toEqual({
      repositoryOwner: "frknian",
      repositoryName: "agent-hub",
      repositoryUrl: "https://github.com/frknian/agent-hub",
    });
  });
  it.each([
    "http://github.com/a/b",
    "https://github.com.evil.test/a/b",
    "https://github.com/a/b/issues",
    "https://user:pass@github.com/a/b",
    "https://github.com/a/b?token=x",
    "https://github.com/a/b#readme",
    "https://gitlab.com/a/b",
    "https://github.com/a/.git",
    "not a url",
  ])("rejects %s", (url) => {
    expect(
      projectInput.safeParse({ name: "Project", repositoryUrl: url }).success,
    ).toBe(false);
  });
  it("rejects empty and oversized names", () => {
    for (const name of ["  ", "x".repeat(101)])
      expect(
        projectInput.safeParse({
          name,
          repositoryUrl: "https://github.com/a/b",
        }).success,
      ).toBe(false);
  });
});
describe("task input", () => {
  it("trims text and excludes injected status", () => {
    expect(
      taskInput.parse({
        projectId: "00000000-0000-4000-8000-000000000001",
        title: " Fix GPS ",
        description: " Context ",
        status: "completed",
      }),
    ).toEqual({
      projectId: "00000000-0000-4000-8000-000000000001",
      title: "Fix GPS",
      description: "Context",
    });
  });
  it("rejects invalid project IDs and empty titles", () => {
    expect(
      taskInput.safeParse({ projectId: "bad", title: "", description: "" })
        .success,
    ).toBe(false);
  });
  it("defines the eight milestone statuses", () =>
    expect(taskStatuses).toHaveLength(8));
});
it("requires server configuration without printing secret values", () => {
  expect(envSchema.safeParse({}).success).toBe(false);
  expect(
    envSchema.safeParse({
      DATABASE_URL: "https://example.com",
      NEXTAUTH_URL: "http://localhost:3000",
      NEXTAUTH_SECRET: "x".repeat(32),
      GITHUB_CLIENT_ID: "id",
      GITHUB_CLIENT_SECRET: "secret",
    }).success,
  ).toBe(false);
});
