import { z } from "zod";
import { parseStructuredResponse } from "./analysis";

export const codingFileChangeSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(500)
    .refine((p) => !p.startsWith("/") && !p.startsWith("../"), {
      message: "Path must be relative and cannot escape workspace",
    }),
  operation: z.enum(["update", "create"]),
  content: z.string().max(300_000),
  reason: z.string().max(1000),
});

export type CodingFileChange = z.infer<typeof codingFileChangeSchema>;

export const codingResultSchema = z.object({
  summary: z.string().min(1).max(4000),
  changes: z.array(codingFileChangeSchema).min(1).max(20),
  notes: z.array(z.string().max(1000)).max(20),
  risks: z.array(z.string().max(1000)).max(20),
  suggested_tests: z.array(z.string().max(1000)).max(20),
});

export type CodingResult = z.infer<typeof codingResultSchema>;

export type FileDiff = {
  path: string;
  operation: "update" | "create";
  additions: number;
  deletions: number;
  diff: string;
};

// Forbidden file patterns that must never be created or updated by agent
const FORBIDDEN_PATTERNS = [
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)\.env(\..+)?$/i,
  /(^|\/)(vendor|dist|build|\.next|Pods|DerivedData)(\/|$)/i,
  /\.(pem|key|pfx|pkcs12|p8)$/i,
  /(^|\/)(id_rsa|id_ed25519)(\..+)?$/i,
  /\.(png|jpe?g|gif|webp|pdf|zip|gz|tar|ico|woff2?|exe|dll|so|dylib)$/i,
  /(^|\/)(credentials|secrets|passwords?)\.(json|ya?ml|txt)$/i,
];

// Patterns that require explicit human approval before being allowed
const APPROVAL_REQUIRED_PATTERNS = [
  /(^|\/)drizzle\/.*\.sql$/i,
  /(^|\/)migrations?\/.*\.sql$/i,
  /(^|\/)\.github\/workflows\/.*\.ya?ml$/i,
  /(^|\/)(Dockerfile|docker-compose.*\.ya?ml)$/i,
  /(^|\/)k8s\/.*\.ya?ml$/i,
  /(^|\/)helm\/.*$/i,
];

export function validateFileSafety(path: string): {
  allowed: boolean;
  approvalRequired: boolean;
  reason?: string;
} {
  const normalized = path.replace(/\\/g, "/").trim();

  // Check forbidden
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        approvalRequired: false,
        reason: `Dosya güvenlik kuralı ihlali: '${normalized}' dosyasına erişim engellendi.`,
      };
    }
  }

  // Check approval required
  for (const pattern of APPROVAL_REQUIRED_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: true,
        approvalRequired: true,
        reason: `Hassas sistem dosyası: '${normalized}' için kullanıcı onayı gereklidir.`,
      };
    }
  }

  return { allowed: true, approvalRequired: false };
}

export function generateSimpleDiff(
  oldContent: string,
  newContent: string,
  path: string,
): FileDiff {
  const oldLines = oldContent ? oldContent.split("\n") : [];
  const newLines = newContent.split("\n");

  const diffLines: string[] = [`--- a/${path}`, `+++ b/${path}`];
  let additions = 0;
  let deletions = 0;

  if (oldLines.length === 0) {
    // Brand new file
    additions = newLines.length;
    diffLines.push(`@@ -0,0 +1,${newLines.length} @@`);
    for (const line of newLines) {
      diffLines.push(`+${line}`);
    }
  } else {
    // Line by line diff
    let i = 0;
    let j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (
        i < oldLines.length &&
        j < newLines.length &&
        oldLines[i] === newLines[j]
      ) {
        i++;
        j++;
      } else {
        const chunkOld: string[] = [];
        const chunkNew: string[] = [];
        while (
          i < oldLines.length &&
          (j >= newLines.length ||
            !newLines.slice(j, j + 5).includes(oldLines[i]))
        ) {
          chunkOld.push(oldLines[i]);
          i++;
        }
        while (
          j < newLines.length &&
          (i >= oldLines.length ||
            !oldLines.slice(i, i + 5).includes(newLines[j]))
        ) {
          chunkNew.push(newLines[j]);
          j++;
        }

        if (chunkOld.length > 0 || chunkNew.length > 0) {
          diffLines.push(
            `@@ -${i - chunkOld.length + 1},${chunkOld.length} +${j - chunkNew.length + 1},${chunkNew.length} @@`,
          );
          for (const line of chunkOld) {
            diffLines.push(`-${line}`);
            deletions++;
          }
          for (const line of chunkNew) {
            diffLines.push(`+${line}`);
            additions++;
          }
        }
      }
    }
  }

  return {
    path,
    operation: oldLines.length === 0 ? "create" : "update",
    additions,
    deletions,
    diff: diffLines.join("\n"),
  };
}

export const codingPrompt = `You are an expert full-stack coding agent. Implement the required task changes precisely.
Return ONLY valid JSON matching this schema:
{
  "summary": "Short Turkish summary of what was coded",
  "changes": [
    {
      "path": "relative/file/path.ext",
      "operation": "update" or "create",
      "content": "Complete file content including all unchanged parts",
      "reason": "Why this change was made"
    }
  ],
  "notes": ["Important notes about the implementation"],
  "risks": ["Potential risks or considerations"],
  "suggested_tests": ["Commands or checks to verify the change"]
}

STRICT RULES:
1. Return ONLY the JSON object. No markdown wrapping outside the JSON, no explanations outside JSON.
2. DELETE and RENAME operations are strictly FORBIDDEN. Only "update" and "create" are allowed.
3. For "update", provide the FULL, complete file content. Do not use placeholders like "// ...rest of code".
4. Never modify .git, node_modules, .env, or credential files.
5. Use Turkish for summary, notes, risks, and reasons.
6. Address all root causes identified in the primary analysis and adhere to Kimi's review recommendations.`;

export function buildCodingContext(input: {
  task: { title: string; description: string };
  repository: { owner: string; repo: string; branch: string };
  analysis: Record<string, unknown>;
  review?: Record<string, unknown> | null;
  files: { path: string; content: string }[];
}): string {
  let remainingChars = 24_000;
  const selectedFiles = input.files.slice(0, 6).map((file) => {
    const truncated = file.content.slice(0, Math.min(4000, remainingChars));
    remainingChars -= truncated.length;
    return {
      path: file.path,
      content: truncated,
      isTruncated: truncated.length < file.content.length,
    };
  });

  return JSON.stringify({
    task: input.task,
    repository: input.repository,
    primary_analysis: {
      summary: input.analysis.summary,
      root_causes: input.analysis.root_causes,
      relevant_files: input.analysis.relevant_files,
      implementation_plan: input.analysis.implementation_plan,
      risks: input.analysis.risks,
    },
    reviewer_feedback: input.review
      ? {
          verdict: input.review.verdict,
          recommended_changes: input.review.recommended_changes,
          weaknesses: input.review.weaknesses,
          missed_issues: input.review.missed_issues,
        }
      : null,
    source_files: selectedFiles,
  });
}

export function parseCodingResponse(content: string): CodingResult {
  return parseStructuredResponse(content, codingResultSchema);
}
