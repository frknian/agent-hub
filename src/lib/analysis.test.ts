import { expect, it } from "vitest";
import {
  parseAnalysisResponse,
  validateWithRepair,
  analysisDiagnostics,
  validateAnalysisFiles,
  formatCompactTree,
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

it("validates analyst paths against repository tree (valid, hallucinated, mixed, zero)", () => {
  const tree = [
    "components/RouteHistoryCard.tsx",
    "lib/gps-tracking.ts",
    "app/page.tsx",
  ];

  // 1. Valid repo paths
  const validFiles = [
    {
      path: "components/RouteHistoryCard.tsx",
      reason: "Route history display",
    },
    { path: "./lib/gps-tracking.ts", reason: "GPS service" },
  ];
  const res1 = validateAnalysisFiles(validFiles, tree);
  expect(res1.valid).toHaveLength(2);
  expect(res1.valid[1].path).toBe("lib/gps-tracking.ts");
  expect(res1.invalid).toHaveLength(0);

  // 2. Hallucinated paths
  const hallucinatedFiles = [
    { path: "app/routes/components/PlanScreen.vue", reason: "Vue screen" },
    { path: "app/routes/services/MapService.ts", reason: "Vue service" },
  ];
  const res2 = validateAnalysisFiles(hallucinatedFiles, tree);
  expect(res2.valid).toHaveLength(0);
  expect(res2.invalid).toEqual([
    "app/routes/components/PlanScreen.vue",
    "app/routes/services/MapService.ts",
  ]);

  // 3. Mixed valid + invalid paths
  const mixedFiles = [
    { path: "app/page.tsx", reason: "Home page" },
    { path: "components/FakeComponent.tsx", reason: "Not in repo" },
  ];
  const res3 = validateAnalysisFiles(mixedFiles, tree);
  expect(res3.valid).toEqual([{ path: "app/page.tsx", reason: "Home page" }]);
  expect(res3.invalid).toEqual(["components/FakeComponent.tsx"]);

  // 4. Zero valid paths
  const res4 = validateAnalysisFiles([], tree);
  expect(res4.valid).toHaveLength(0);
  expect(res4.invalid).toHaveLength(0);
});

it("formats compact repository tree prioritizing source code", () => {
  const paths = [
    "README.md",
    "components/RouteHistoryCard.tsx",
    ".gitignore",
    "lib/gps-tracking.ts",
  ];
  const formatted = formatCompactTree(paths, 2);
  expect(formatted).toContain("components/RouteHistoryCard.tsx");
  expect(formatted).toContain("lib/gps-tracking.ts");
  expect(formatted).not.toContain("README.md");
});
