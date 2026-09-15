import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
}));
vi.mock("@/db", () => ({
  getDb: () => ({ select: mocks.select, insert: mocks.insert }),
}));
import { createTask, ownedProject, listTasks } from "./projects";
const projectId = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.select.mockReturnValue({
    from: () => ({
      where: mocks.where,
      innerJoin: () => ({ where: mocks.where }),
    }),
  });
  mocks.where.mockReturnValue({ limit: mocks.limit, orderBy: () => [] });
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockReturnValue({ returning: mocks.returning });
  mocks.returning.mockResolvedValue([{ id: projectId }]);
});
it("rejects unowned task creation before any insert", async () => {
  mocks.limit.mockResolvedValue([]);
  await expect(
    createTask("other-user", { projectId, title: "Fix", description: "" }),
  ).rejects.toThrow("Project unavailable");
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("inserts owned tasks as queued despite submitted status", async () => {
  mocks.limit.mockResolvedValue([{ id: projectId }]);
  await createTask("owner", {
    projectId,
    title: "Fix",
    description: "",
    status: "completed",
  });
  expect(mocks.values).toHaveBeenCalledWith({
    projectId,
    title: "Fix",
    description: "",
    status: "queued",
  });
});
it("malformed project IDs do not reach the database", async () => {
  expect(await ownedProject("owner", "malformed")).toBeNull();
  expect(mocks.select).not.toHaveBeenCalled();
});
it("project lookup and task listing include owner predicates", async () => {
  mocks.limit.mockResolvedValue([]);
  await ownedProject("owner", projectId);
  const predicate = mocks.where.mock.calls[0][0];
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  const lookup = dialect.sqlToQuery(predicate);
  expect(lookup.sql).toContain('"projects"."user_id"');
  expect(lookup.params).toContain("owner");
  await listTasks("owner");
  const listing = dialect.sqlToQuery(mocks.where.mock.calls[1][0]);
  expect(listing.sql).toContain('"projects"."user_id"');
  expect(listing.params).toContain("owner");
});
it("returns an empty workspace safely when a user has no projects or tasks", async () => {
  expect(await listTasks("new-user")).toEqual([]);
});
