import { describe, expect, it } from "vitest";
import { isMissingRelationError } from "./database-errors";

describe("database schema fallback", () => {
  it("recognizes a wrapped missing-table error without exposing query details", () => {
    expect(isMissingRelationError({ cause: { code: "42P01" } })).toBe(true);
  });

  it("does not hide unrelated database errors", () => {
    expect(isMissingRelationError({ cause: { code: "23505" } })).toBe(false);
  });
});
