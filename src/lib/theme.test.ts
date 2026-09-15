import { describe, expect, it } from "vitest";
import { parseTheme, resolveTheme } from "./theme";

describe("theme preferences", () => {
  it("accepts supported stored preferences and defaults invalid values to system", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("unexpected")).toBe("system");
    expect(parseTheme(null)).toBe("system");
  });

  it("resolves the system preference against the operating system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
