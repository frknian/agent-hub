"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createProject, createTask } from "@/services/projects";
import {
  removeProviderCredential,
  saveProviderCredential,
  testProviderCredential,
} from "@/services/providers";
import { saveAgentSystem } from "@/services/agent-systems";
import {
  agentSystemInput,
  providerCredentialInput,
  providerIds,
  projectInput,
  taskInput,
} from "@/lib/validation";
export type FormState = { error?: string; success?: string };
export async function addProject(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const data = projectInput.safeParse({
    name: form.get("name"),
    repositoryUrl: form.get("repositoryUrl"),
  });
  if (!data.success) return { error: data.error.issues[0].message };
  try {
    const result = await createProject(user.id, data.data);
    if (!result.length) return { error: "Bu depo zaten eklenmiş." };
  } catch {
    return { error: "Proje kaydedilemedi. Lütfen tekrar deneyin." };
  }
  revalidatePath("/", "layout");
  return { success: "Proje eklendi." };
}
export async function addTask(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const data = taskInput.safeParse({
    projectId: form.get("projectId"),
    title: form.get("title"),
    description: form.get("description"),
  });
  if (!data.success) return { error: data.error.issues[0].message };
  try {
    await createTask(user.id, data.data);
  } catch {
    return { error: "Görev kaydedilemedi. Proje erişimini kontrol edin." };
  }
  revalidatePath("/", "layout");
  return { success: "Görev sıraya eklendi." };
}

export async function saveProviderKey(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const data = providerCredentialInput.safeParse({
    provider: form.get("provider"),
    apiKey: form.get("apiKey"),
    baseUrl: form.get("baseUrl"),
  });
  if (!data.success) return { error: data.error.issues[0].message };
  try {
    await saveProviderCredential(user.id, data.data);
  } catch {
    return { error: "Anahtar güvenli biçimde kaydedilemedi." };
  }
  revalidatePath("/settings/providers");
  revalidatePath("/agents");
  return {
    success: "Anahtar kaydedildi. Bağlantıyı şimdi test edebilirsiniz.",
  };
}
export async function testProviderKey(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const provider = form.get("provider");
  if (
    typeof provider !== "string" ||
    !providerIds.includes(provider as (typeof providerIds)[number])
  )
    return { error: "Geçersiz sağlayıcı." };
  try {
    const status = await testProviderCredential(
      user.id,
      provider as (typeof providerIds)[number],
    );
    revalidatePath("/settings/providers");
    return status.status === "connected"
      ? { success: "Bağlantı doğrulandı." }
      : {
          error: (
            {
              invalid_key: "API key geçersiz.",
              endpoint: "Region veya API Host uyuşmuyor.",
              model_access: "Model erişimi yok.",
              quota: "Billing veya kota sorunu var.",
              network: "Ağ hatası oluştu.",
              unknown: "Sağlayıcı bağlantısı doğrulanamadı.",
            } as const
          )[status.errorType ?? "unknown"],
        };
  } catch {
    return { error: "Bağlantı testi tamamlanamadı." };
  }
}
export async function deleteProviderKey(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const provider = form.get("provider");
  if (
    typeof provider !== "string" ||
    !providerIds.includes(provider as (typeof providerIds)[number])
  )
    return { error: "Geçersiz sağlayıcı." };
  await removeProviderCredential(
    user.id,
    provider as (typeof providerIds)[number],
  );
  revalidatePath("/settings/providers");
  revalidatePath("/settings/agent-system");
  revalidatePath("/agents");
  return { success: "Sağlayıcı anahtarı kaldırıldı." };
}
export async function saveAgentSettings(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const raw = form.get("settings");
  try {
    const parsed = agentSystemInput.parse(
      typeof raw === "string" ? JSON.parse(raw) : null,
    );
    await saveAgentSystem(user.id, parsed);
  } catch {
    return {
      error:
        "Ayarlar kaydedilemedi. Bağlı sağlayıcıları ve seçimleri kontrol edin.",
    };
  }
  revalidatePath("/settings/agent-system");
  revalidatePath("/agents");
  return { success: "Agent sistemi kaydedildi." };
}
