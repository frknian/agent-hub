"use client";
import { useActionState } from "react";
import {
  deleteProviderKey,
  saveProviderKey,
  testProviderKey,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProviderId } from "@/config/agent-presets";

type Credential = {
  provider: ProviderId;
  keyHint: string;
  status: "untested" | "connected" | "error";
  lastTestedAt: Date | null;
  baseUrl: string | null;
};
export function ProviderSettings({
  credentials,
}: {
  credentials: Credential[];
}) {
  const providers: { id: ProviderId; label: string; text: string }[] = [
    {
      id: "qwen",
      label: "Qwen / Alibaba",
      text: "Qwen modelleri için kendi API anahtarınız.",
    },
    {
      id: "kimi",
      label: "Kimi / Moonshot",
      text: "Moonshot Kimi modelleri için kendi API anahtarınız.",
    },
    {
      id: "openai",
      label: "OpenAI",
      text: "OpenAI modelleri için kendi API anahtarınız.",
    },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          credential={credentials.find((item) => item.provider === provider.id)}
        />
      ))}
    </div>
  );
}
function ProviderCard({
  provider,
  credential,
}: {
  provider: { id: ProviderId; label: string; text: string };
  credential?: Credential;
}) {
  const [saveState, saveAction, saving] = useActionState(saveProviderKey, {});
  const [testState, testAction, testing] = useActionState(testProviderKey, {});
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteProviderKey,
    {},
  );
  const status =
    credential?.status === "connected"
      ? "Bağlı"
      : credential?.status === "error"
        ? "Hata"
        : credential
          ? "Test edilmedi"
          : "Bağlı değil";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {provider.label}
          <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
            {status}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{provider.text}</p>
        {credential && (
          <p className="text-xs text-muted-foreground">
            Kayıtlı anahtar sonu: ••••{credential.keyHint}
          </p>
        )}
        <form action={saveAction} className="space-y-2">
          <input type="hidden" name="provider" value={provider.id} />
          <label className="block text-sm font-medium">
            {credential ? "Anahtarı değiştir" : "API anahtarı"}
            <Input
              className="mt-2"
              name="apiKey"
              type="password"
              autoComplete="off"
              required
              minLength={8}
              maxLength={1000}
            />
          </label>
          {provider.id === "qwen" && (
            <label className="block text-sm font-medium">
              API Host / Base URL
              <Input
                className="mt-2"
                name="baseUrl"
                type="url"
                required
                defaultValue={credential?.baseUrl ?? ""}
                placeholder="https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1"
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Singapore workspace endpoint’i.
              </span>
            </label>
          )}
          <Button type="submit" disabled={saving}>
            {saving
              ? "Kaydediliyor…"
              : credential
                ? "Anahtarı güncelle"
                : "Anahtarı ekle"}
          </Button>
        </form>
        {credential && (
          <div className="flex flex-wrap gap-2">
            <form action={testAction}>
              <input type="hidden" name="provider" value={provider.id} />
              <Button type="submit" variant="outline" disabled={testing}>
                {testing ? "Test ediliyor…" : "Bağlantıyı test et"}
              </Button>
            </form>
            <form action={deleteAction}>
              <input type="hidden" name="provider" value={provider.id} />
              <Button type="submit" variant="ghost" disabled={deleting}>
                {deleting ? "Kaldırılıyor…" : "Kaldır"}
              </Button>
            </form>
          </div>
        )}
        <div aria-live="polite" className="text-sm">
          {saveState.error || testState.error || deleteState.error ? (
            <p className="text-destructive" role="alert">
              {saveState.error || testState.error || deleteState.error}
            </p>
          ) : (
            <p className="text-primary">
              {saveState.success || testState.success || deleteState.success}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
