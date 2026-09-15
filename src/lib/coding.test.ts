import { describe, expect, it } from "vitest";
import {
  validateFileSafety,
  generateSimpleDiff,
  parseCodingResponse,
  buildCodingContext,
} from "./coding";

describe("validateFileSafety", () => {
  it("allows standard source code files", () => {
    expect(validateFileSafety("src/components/Button.tsx")).toEqual({
      allowed: true,
      approvalRequired: false,
    });
    expect(validateFileSafety("lib/utils.ts")).toEqual({
      allowed: true,
      approvalRequired: false,
    });
    expect(validateFileSafety("pages/api/health.ts")).toEqual({
      allowed: true,
      approvalRequired: false,
    });
  });

  it("blocks sensitive and forbidden files", () => {
    expect(validateFileSafety(".env")).toEqual({
      allowed: false,
      approvalRequired: false,
      reason: expect.stringMatching(/güvenlik/i),
    });
    expect(validateFileSafety(".env.local")).toEqual({
      allowed: false,
      approvalRequired: false,
      reason: expect.stringMatching(/güvenlik/i),
    });
    expect(validateFileSafety(".git/config")).toEqual({
      allowed: false,
      approvalRequired: false,
      reason: expect.stringMatching(/güvenlik/i),
    });
    expect(validateFileSafety("node_modules/package/index.js")).toEqual({
      allowed: false,
      approvalRequired: false,
      reason: expect.stringMatching(/güvenlik/i),
    });
    expect(validateFileSafety("id_rsa")).toEqual({
      allowed: false,
      approvalRequired: false,
      reason: expect.stringMatching(/güvenlik/i),
    });
  });

  it("identifies approval required files", () => {
    const migration = validateFileSafety("drizzle/0001_add_table.sql");
    expect(migration.allowed).toBe(true);
    expect(migration.approvalRequired).toBe(true);

    const workflow = validateFileSafety(".github/workflows/deploy.yml");
    expect(workflow.allowed).toBe(true);
    expect(workflow.approvalRequired).toBe(true);

    const docker = validateFileSafety("Dockerfile");
    expect(docker.allowed).toBe(true);
    expect(docker.approvalRequired).toBe(true);
  });
});

describe("generateSimpleDiff", () => {
  it("generates additions for new file", () => {
    const diff = generateSimpleDiff("", "line 1\nline 2", "test.txt");
    expect(diff.path).toBe("test.txt");
    expect(diff.additions).toBe(2);
    expect(diff.deletions).toBe(0);
    expect(diff.diff).toContain("+line 1");
    expect(diff.diff).toContain("+line 2");
  });

  it("generates additions and deletions for updated file", () => {
    const oldContent = "hello\nworld";
    const newContent = "hello\neveryone";
    const diff = generateSimpleDiff(oldContent, newContent, "greeting.txt");
    expect(diff.additions).toBe(1);
    expect(diff.deletions).toBe(1);
    expect(diff.diff).toContain("-world");
    expect(diff.diff).toContain("+everyone");
  });
});

describe("parseCodingResponse", () => {
  it("parses pure JSON string successfully", () => {
    const input = JSON.stringify({
      summary: "Created button component",
      changes: [
        {
          path: "src/button.tsx",
          operation: "create",
          content: "export const Button = () => <button />;",
          reason: "Needed UI button",
        },
      ],
      notes: ["Clean implementation"],
      risks: [],
      suggested_tests: ["Render button test"],
    });

    const parsed = parseCodingResponse(input);
    expect(parsed.summary).toBe("Created button component");
    expect(parsed.changes).toHaveLength(1);
    expect(parsed.changes[0].operation).toBe("create");
  });

  it("extracts and parses JSON wrapped in markdown code blocks", () => {
    const raw = `Here is the patch:
\`\`\`json
{
  "summary": "Fix route handling",
  "changes": [
    {
      "path": "src/api/route.ts",
      "operation": "update",
      "content": "export function GET() {}",
      "reason": "Fix 404"
    }
  ],
  "notes": [],
  "risks": [],
  "suggested_tests": []
}
\`\`\`
Hope this helps!`;

    const parsed = parseCodingResponse(raw);
    expect(parsed.summary).toBe("Fix route handling");
    expect(parsed.changes[0].path).toBe("src/api/route.ts");
  });

  it("extracts JSON with explanatory text before and after without code fence", () => {
    const raw = `I have analyzed the problem and here is the solution:
{
  "summary": "Fix bug in calculation",
  "changes": [
    {
      "path": "src/calc.ts",
      "operation": "update",
      "content": "export const add = (a, b) => a + b;",
      "reason": "Correct sum"
    }
  ]
}
Let me know if you need anything else!`;

    const parsed = parseCodingResponse(raw);
    expect(parsed.summary).toBe("Fix bug in calculation");
    expect(parsed.changes[0].path).toBe("src/calc.ts");
    expect(parsed.notes).toEqual([]);
    expect(parsed.risks).toEqual([]);
    expect(parsed.suggested_tests).toEqual([]);
  });

  it("normalizes camelCase suggestedTests and file field to path", () => {
    const raw = JSON.stringify({
      summary: "Normalize fields test",
      changes: [
        {
          file: "./src/index.ts",
          operation: "UPDATE",
          content: "console.log('updated');",
        },
      ],
      suggestedTests: ["npm test", "npm run lint"],
    });

    const parsed = parseCodingResponse(raw);
    expect(parsed.changes[0].path).toBe("src/index.ts");
    expect(parsed.changes[0].operation).toBe("update");
    expect(parsed.suggested_tests).toEqual(["npm test", "npm run lint"]);
  });

  it("normalizes uppercase CREATE to lowercase create", () => {
    const raw = JSON.stringify({
      summary: "New file creation",
      changes: [
        {
          path: "src/new-feature.ts",
          operation: "CREATE",
          content: "export const ok = true;",
        },
      ],
    });

    const parsed = parseCodingResponse(raw);
    expect(parsed.changes[0].operation).toBe("create");
  });

  it("strictly rejects forbidden operations (delete, remove, rename, move)", () => {
    const deletePayload = JSON.stringify({
      summary: "Remove old file",
      changes: [
        {
          path: "src/legacy.ts",
          operation: "delete",
          content: "",
        },
      ],
    });
    expect(() => parseCodingResponse(deletePayload)).toThrow(
      /forbidden_operation/i,
    );

    const renamePayload = JSON.stringify({
      summary: "Rename file",
      changes: [
        {
          path: "src/old.ts",
          operation: "rename",
          content: "",
        },
      ],
    });
    expect(() => parseCodingResponse(renamePayload)).toThrow(
      /forbidden_operation/i,
    );
  });

  it("handles regression Hedefit response with code fences inside code content", () => {
    const raw = JSON.stringify({
      summary: "Fix Hedefit route handler and auth enhancement",
      changes: [
        {
          path: "app/api/plan/route.ts",
          operation: "update",
          content:
            "```typescript\nimport { NextResponse } from 'next/server';\nexport async function POST() {\n  return NextResponse.json({ ok: true });\n}\n```",
          reason: "Wrap handler in try-catch and return proper response",
        },
      ],
      notes: ["Secured handler"],
      risks: ["None"],
      suggested_tests: ["curl -X POST /api/plan"],
    });

    const parsed = parseCodingResponse(raw);
    expect(parsed.changes[0].content.startsWith("```")).toBe(false);
    expect(parsed.changes[0].content).toContain("import { NextResponse }");
  });

  it("throws for invalid or unparseable payload", () => {
    expect(() => parseCodingResponse("not a json at all")).toThrow();
  });
});

describe("buildCodingContext", () => {
  it("includes task, analysis, and files in context", () => {
    const context = buildCodingContext({
      task: { title: "Test Task", description: "Fix bug" },
      repository: { owner: "owner", repo: "repo", branch: "agent/task-1" },
      analysis: { summary: "Analysis summary" },
      review: { verdict: "approve" },
      files: [{ path: "src/index.ts", content: "console.log('hi');" }],
    });

    const parsed = JSON.parse(context);
    expect(parsed.task.title).toBe("Test Task");
    expect(parsed.task.description).toBe("Fix bug");
    expect(parsed.primary_analysis.summary).toBe("Analysis summary");
    expect(parsed.reviewer_feedback.verdict).toBe("approve");
    expect(parsed.source_files[0].path).toBe("src/index.ts");
  });
});
