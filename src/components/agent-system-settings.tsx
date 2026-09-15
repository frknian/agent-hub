"use client";
import { useActionState, useMemo, useState } from "react";
import { saveAgentSettings } from "@/app/actions";
import {
  BALANCED_DEVELOPER_PRESET,
  type AgentRoute,
  type ProviderId,
} from "@/config/agent-presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { providerCatalog } from "@/config/provider-catalog";

type Settings = {
  mode: "preset" | "custom";
  premiumApproval: "manual" | "disabled";
  roles: AgentRoute[];
};
export function AgentSystemSettings({
  initial,
  connectedProviders,
}: {
  initial: Settings;
  connectedProviders: ProviderId[];
}) {
  const [mode, setMode] = useState(initial.mode);
  const [approval, setApproval] = useState(initial.premiumApproval);
  const [roles, setRoles] = useState<AgentRoute[]>(
    initial.roles.length === 4
      ? initial.roles
      : [...BALANCED_DEVELOPER_PRESET.roles],
  );
  const [state, action, pending] = useActionState(saveAgentSettings, {});
  const data = useMemo(
    () =>
      JSON.stringify({
        mode,
        premiumApproval: approval,
        roles: mode === "preset" ? BALANCED_DEVELOPER_PRESET.roles : roles,
      }),
    [mode, approval, roles],
  );
  const update = (index: number, patch: Partial<AgentRoute>) =>
    setRoles((all) =>
      all.map((role, position) =>
        position === index ? { ...role, ...patch } : role,
      ),
    );
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="settings" value={data} />
      <fieldset>
        <legend className="text-sm font-medium">Yapılandırma</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={mode === "preset" ? "default" : "outline"}
            onClick={() => setMode("preset")}
          >
            Balanced Developer
          </Button>
          <Button
            type="button"
            variant={mode === "custom" ? "default" : "outline"}
            onClick={() => setMode("custom")}
          >
            Özel yapılandırma
          </Button>
        </div>
      </fieldset>
      {mode === "preset" ? (
        <Preset />
      ) : (
        <Custom roles={roles} connected={connectedProviders} update={update} />
      )}
      <fieldset>
        <legend className="text-sm font-medium">Premium model kullanımı</legend>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={approval === "manual"}
            onChange={(event) =>
              setApproval(event.target.checked ? "manual" : "disabled")
            }
          />{" "}
          Her premium kullanımından önce manuel onay iste
        </label>
      </fieldset>
      <div aria-live="polite">
        {state.error && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="text-sm text-primary">{state.success}</p>
        )}
      </div>
      <Button
        type="submit"
        disabled={pending || connectedProviders.length === 0}
      >
        {pending ? "Kaydediliyor…" : "Sistemi kaydet"}
      </Button>
      {connectedProviders.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Önce en az bir sağlayıcıyı ekleyip bağlantısını doğrulayın.
        </p>
      )}
    </form>
  );
}
function Preset() {
  return (
    <div className="rounded-lg border bg-muted/40 p-4 text-sm">
      <p className="font-medium">Balanced Developer</p>
      <ol className="mt-3 grid gap-2 md:grid-cols-4">
        {BALANCED_DEVELOPER_PRESET.roles.map((route, index) => (
          <li key={route.role} className="rounded-md bg-background p-3">
            <span className="text-muted-foreground">
              {index + 1}. {route.role}
            </span>
            <br />
            {providerCatalog[route.provider].label}
            <br />
            <span className="text-xs text-muted-foreground">{route.model}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-muted-foreground">
        Sıra: Qwen3-Coder-Next → Kimi K2.5 → GPT-5.6 Sol. Premium kullanım
        manuel onay gerektirir.
      </p>
    </div>
  );
}
function Custom({
  roles,
  connected,
  update,
}: {
  roles: AgentRoute[];
  connected: ProviderId[];
  update: (index: number, patch: Partial<AgentRoute>) => void;
}) {
  return (
    <div className="grid gap-3">
      {roles.map((role, index) => (
        <div
          key={role.role}
          className="grid gap-2 rounded-lg border p-3 md:grid-cols-3"
        >
          <label className="text-sm font-medium capitalize">
            {role.role}
            <Input className="mt-1" value={role.role} readOnly />
          </label>
          <label className="text-sm font-medium">
            Sağlayıcı
            <select
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={role.provider}
              onChange={(event) => {
                const provider = event.target.value as ProviderId;
                update(index, {
                  provider,
                  model: providerCatalog[provider].models[0].id,
                });
              }}
            >
              {connected.map((provider) => (
                <option key={provider} value={provider}>
                  {providerCatalog[provider].label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Model
            <select
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={role.model}
              onChange={(event) => update(index, { model: event.target.value })}
            >
              {providerCatalog[role.provider].models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}
    </div>
  );
}
