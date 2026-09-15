import { z } from "zod";
export const analysisResult = z.object({
  task_type: z.string().max(80),
  summary: z.string().max(4000),
  root_causes: z.array(z.string().max(1000)).max(20),
  relevant_files: z
    .array(
      z.object({ path: z.string().max(500), reason: z.string().max(1000) }),
    )
    .max(20),
  implementation_plan: z.array(z.string().max(1000)).max(20),
  risks: z.array(z.string().max(1000)).max(20),
  test_plan: z.array(z.string().max(1000)).max(20),
  confidence: z.number().min(0).max(1),
});
export type AnalysisResult = z.infer<typeof analysisResult>;
export const executionErrorCodes = [
  "provider_not_connected",
  "invalid_api_key",
  "provider_quota",
  "provider_billing",
  "repository_not_found",
  "github_access_error",
  "context_error",
  "model_invalid_response",
  "network_error",
  "execution_timeout",
] as const;
export type ExecutionErrorCode = (typeof executionErrorCodes)[number];

// Locate one complete JSON object without evaluating or repairing arbitrary text.
export function parseStructuredResponse<T>(
  content: string,
  schema: z.ZodType<T>,
): T {
  if (content.length > 100_000) throw new SyntaxError("response_too_large");
  let failure: unknown = new SyntaxError("invalid_json");
  for (
    let start = content.indexOf("{"), attempts = 0;
    start >= 0 && attempts < 32;
    start = content.indexOf("{", start + 1), attempts++
  ) {
    try {
      let depth = 0,
        quoted = false,
        escaped = false;
      for (let i = start; start >= 0 && i < content.length; i++) {
        const char = content[i];
        if (quoted) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') quoted = false;
        } else if (char === '"') quoted = true;
        else if (char === "{") depth++;
        else if (char === "}" && --depth === 0) {
          const data = JSON.parse(content.slice(start, i + 1));
          if (data && typeof data === "object") {
            const value = data.confidence;
            const numeric =
              typeof value === "number"
                ? value
                : typeof value === "string" &&
                    /^\s*\d+(?:\.\d+)?%?\s*$/.test(value)
                  ? Number(value.trim().replace(/%$/, ""))
                  : NaN;
            if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 100)
              data.confidence =
                numeric > 1 ||
                (typeof value === "string" && value.includes("%"))
                  ? numeric / 100
                  : numeric;
          }
          return schema.parse(data);
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError || !(failure instanceof z.ZodError))
        failure = error;
    }
  }
  throw failure;
}

function responseFormat(content: string) {
  return {
    characters: content.length,
    containsObject: content.includes("{"),
    containsSchema: content.includes('"task_type"'),
    codeFence: content.includes("```"),
    thinking: content.includes("<think>"),
  };
}

export function analysisDiagnostics(error: unknown) {
  return error instanceof z.ZodError
    ? {
        reason: "schema_validation",
        issues: error.issues.map((issue) => ({
          field:
            typeof issue.path[0] === "string" &&
            issue.path[0] in analysisResult.shape
              ? issue.path[0]
              : "response",
          code: issue.code,
        })),
      }
    : { reason: "invalid_json", issues: [] };
}

export async function validateWithRepair(
  content: string,
  repair: (content: string) => Promise<string>,
  report: (
    details: ReturnType<typeof analysisDiagnostics> & {
      format?: ReturnType<typeof responseFormat>;
    },
  ) => void,
): Promise<AnalysisResult> {
  try {
    return parseAnalysisResponse(content);
  } catch (error) {
    report({ ...analysisDiagnostics(error), format: responseFormat(content) });
  }
  // Exactly one repair request, using the same owner-scoped provider.
  try {
    return parseAnalysisResponse(await repair(content.slice(0, 32_000)));
  } catch (error) {
    report(analysisDiagnostics(error));
    throw new Error("model_invalid_response");
  }
}

export function parseAnalysisResponse(content: string): AnalysisResult {
  return parseStructuredResponse(content, analysisResult);
}
