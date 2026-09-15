"use client";
import { useActionState, useEffect, useRef } from "react";
import { addProject, addTask } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
export function EntryForm({ projectId }: { projectId?: string }) {
  const [state, action, pending] = useActionState(
    projectId ? addTask : addProject,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-4">
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      <label className="block text-sm font-medium">
        {projectId ? "Görev başlığı" : "Proje adı"}
        <Input
          className="mt-2"
          name={projectId ? "title" : "name"}
          required
          maxLength={projectId ? 200 : 100}
          placeholder={projectId ? "GPS doğruluk problemini düzelt" : "Hedefit"}
        />
      </label>
      {projectId ? (
        <label className="block text-sm font-medium">
          Açıklama
          <Textarea
            className="mt-2 min-h-28"
            name="description"
            maxLength={10000}
            placeholder="Görevin bağlamını ve beklenen sonucu yazın."
          />
        </label>
      ) : (
        <label className="block text-sm font-medium">
          GitHub depo URL’si
          <Input
            className="mt-2"
            name="repositoryUrl"
            type="url"
            required
            maxLength={300}
            placeholder="https://github.com/sahip/depo"
          />
        </label>
      )}
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
      <Button disabled={pending} type="submit">
        {pending
          ? "Kaydediliyor…"
          : projectId
            ? "Görevi oluştur"
            : "Projeyi ekle"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {projectId
          ? "Görev sıraya alınır. AI çalıştırma henüz etkin değil."
          : "Depo bağlantısı yalnızca kaydedilir."}
      </p>
    </form>
  );
}
