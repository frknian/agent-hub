import { describe, expect, it } from "vitest";
import { BALANCED_DEVELOPER_PRESET } from "@/config/agent-presets";
import { validateConnectedProviders } from "./agent-systems";
describe("agent routing", () => {
  it("uses the documented balanced route order", () => {
    expect(
      BALANCED_DEVELOPER_PRESET.roles.map((role) => role.provider),
    ).toEqual(["qwen", "kimi", "openai", "openai"]);
  });
  it("rejects a role assigned to an unconnected provider", () => {
    expect(
      validateConnectedProviders(BALANCED_DEVELOPER_PRESET.roles, [
        "qwen",
        "kimi",
      ]),
    ).toBe(false);
  });
});
