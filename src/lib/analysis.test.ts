import { expect, it } from "vitest";
import {
  parseAnalysisResponse,
  validateWithRepair,
  analysisDiagnostics,
} from "./analysis";

const result = {
  task_type: "bug_fix",
  summary: "Analysis",
  root_causes: [],
  relevant_files: [],
  implementation_plan: [],
  risks: [],
  test_plan: [],
  confidence: 0.5,
};

it("validates plain and Markdown-wrapped JSON responses", () => {
  const json = JSON.stringify(result);
  expect(parseAnalysisResponse(json)).toEqual(result);
  expect(
    parseAnalysisResponse(
      `\u0060\u0060\u0060json\n${json}\n\u0060\u0060\u0060`,
    ),
  ).toEqual(result);
});

it("rejects truncated output and invalid schema", () => {
  expect(() => parseAnalysisResponse('{"summary":')).toThrow();
  expect(() => parseAnalysisResponse('{"summary":"only summary"}')).toThrow();
});

it("extracts JSON surrounded by explanations and handles escaped braces", () => {
  expect(
    parseAnalysisResponse(
      `Explanation\n${JSON.stringify({ ...result, summary: 'braces { } and "quotes"' })}\nDone`,
    ).summary,
  ).toContain("braces");
});

it("normalizes numeric and string confidence", () => {
  for (const value of [0.95, "0.95", 95, "95", "95%"])
    expect(
      parseAnalysisResponse(JSON.stringify({ ...result, confidence: value }))
        .confidence,
    ).toBe(0.95);
  expect(() =>
    parseAnalysisResponse(JSON.stringify({ ...result, confidence: "unknown" })),
  ).toThrow();
});

it("reports only known field names and issue codes", () => {
  try {
    parseAnalysisResponse('{"summary":"only"}');
  } catch (error) {
    expect(analysisDiagnostics(error).issues).toContainEqual({
      field: "confidence",
      code: "invalid_type",
    });
  }
});

it("repairs once and validates repaired output", async () => {
  let calls = 0;
  expect(
    await validateWithRepair(
      "malformed",
      async () => {
        calls++;
        return JSON.stringify(result);
      },
      () => {},
    ),
  ).toEqual(result);
  expect(calls).toBe(1);
});

it("fails after one unsuccessful repair", async () => {
  let calls = 0;
  await expect(
    validateWithRepair(
      "malformed",
      async () => {
        calls++;
        return "still malformed";
      },
      () => {},
    ),
  ).rejects.toThrow("model_invalid_response");
  expect(calls).toBe(1);
});

it("does not repair already valid output", async () => {
  await validateWithRepair(
    JSON.stringify(result),
    async () => {
      throw new Error("unexpected repair");
    },
    () => {},
  );
});
