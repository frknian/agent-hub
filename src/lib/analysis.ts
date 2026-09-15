import { z } from "zod";
export const analysisResult = z.object({ task_type: z.string().max(80), summary: z.string().max(4000), root_causes: z.array(z.string().max(1000)).max(20), relevant_files: z.array(z.object({ path: z.string().max(500), reason: z.string().max(1000) })).max(20), implementation_plan: z.array(z.string().max(1000)).max(20), risks: z.array(z.string().max(1000)).max(20), test_plan: z.array(z.string().max(1000)).max(20), confidence: z.number().min(0).max(1) });
export type AnalysisResult = z.infer<typeof analysisResult>;
export const executionErrorCodes = ["provider_not_connected", "invalid_api_key", "provider_quota", "provider_billing", "repository_not_found", "github_access_error", "context_error", "model_invalid_response", "network_error", "execution_timeout"] as const;
export type ExecutionErrorCode = (typeof executionErrorCodes)[number];
