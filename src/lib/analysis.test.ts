import { expect, it } from "vitest";
import { parseAnalysisResponse } from "./analysis";

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
  expect(() =>
    parseAnalysisResponse(JSON.stringify({ ...result, confidence: 95 })),
  ).toThrow();
});
