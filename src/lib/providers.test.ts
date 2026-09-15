import { afterEach, expect, it, vi } from "vitest";
import { getProviderAdapter } from "./providers";

afterEach(() => vi.unstubAllGlobals());
it("sends analysis to the owner's same endpoint as the connection test", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetcher);
  const adapter = getProviderAdapter("qwen");
  const endpoint = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
  await adapter.createCompletion(
    "test-only-key",
    "qwen3-coder-next",
    "Analyze",
    endpoint,
  );
  expect(fetcher.mock.calls[0][0]).toBe(`${endpoint}/chat/completions`);
  const options = fetcher.mock.calls[0][1];
  expect(JSON.parse(options.body)).toMatchObject({
    model: "qwen3-coder-next",
    response_format: { type: "json_object" },
  });
  expect(options.redirect).toBe("error");
  expect(options.signal).toBeInstanceOf(AbortSignal);
});
