"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createProject, createTask } from "@/services/projects";
import { projectInput, taskInput } from "@/lib/validation";
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
