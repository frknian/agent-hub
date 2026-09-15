"use client";
import { useActionState, useEffect, useState } from "react";
import { startAnalysis } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
type Run = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  agentRole: string;
  provider: string;
  model: string;
  startedAt: string;
  completedAt: string | null;
  inputTokens: string | null;
  outputTokens: string | null;
  estimatedCost: string | null;
  resultJson: string | null;
  errorCode: string | null;
  reviewer?: Omit<Run, "events" | "reviewer"> | null;
  events: {
    id: string;
    eventType: string;
    status: string;
    message: string;
    createdAt: string;
  }[];
};
const labels: Record<string, string> = {
  provider_not_connected: "Qwen sağlayıcısı bağlı değil.",
  invalid_api_key: "API key geçersiz.",
  provider_quota: "Provider kotası doldu.",
  provider_billing: "Provider billing sorunu var.",
  repository_not_found: "Repository bulunamadı.",
  github_access_error: "GitHub erişimi başarısız.",
  context_error: "Güvenli context hazırlanamadı.",
  model_invalid_response: "Model geçerli analiz sonucu döndürmedi.",
  network_error: "Ağ hatası oluştu.",
  execution_timeout: "Analiz zaman aşımına uğradı.",
};
export function TaskRunMonitor({
  taskId,
  queued,
  initial,
}: {
  taskId: string;
  queued: boolean;
  initial: Run | null;
}) {
  const [run, setRun] = useState(initial);
  const [state, action, pending] = useActionState(startAnalysis, {});
  const running =
    pending ||
    run?.status === "pending" ||
    run?.status === "running" ||
    run?.reviewer?.status === "running";
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}/run`, {
          cache: "no-store",
        });
        if (response.ok) {
          const latest = await response.json();
          if (!cancelled) setRun(latest);
        }
      } catch {
        /* Keep the last confirmed event state on transient network errors. */
      }
    };
    void refresh();
    const timer = running ? setInterval(refresh, 2500) : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [running, taskId, state]);
  const result = run?.resultJson
    ? (JSON.parse(run.resultJson) as Record<string, unknown>)
    : null;
  const review = run?.reviewer?.resultJson
    ? (JSON.parse(run.reviewer.resultJson) as Record<string, unknown>)
    : null;
  const verdictLabels: Record<string, string> = {
    approve: "Approve — Onay",
    needs_revision: "Needs Revision — Revizyon gerekli",
    insufficient_context: "Insufficient Context — Yetersiz context",
  };
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Analiz yürütmesi</h2>
        {((queued && !run) || run?.status === "failed") && (
          <form action={action}>
            <input name="taskId" type="hidden" value={taskId} />
            <Button disabled={pending}>
              {pending
                ? "Başlatılıyor…"
                : run?.status === "failed"
                  ? "Yeniden dene"
                  : "Analizi Başlat"}
            </Button>
          </form>
        )}
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {run && (
        <>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <b>Agent</b>
              <p>{run.agentRole}</p>
            </div>
            <div>
              <b>Provider / Model</b>
              <p>
                {run.provider} · {run.model}
              </p>
            </div>
            <div>
              <b>Durum</b>
              <p>
                {run.reviewer?.status === "running"
                  ? "İnceleniyor"
                  : run.reviewer?.status === "completed"
                    ? "İnceleme tamamlandı"
                    : run.reviewer?.status === "failed"
                      ? "Analiz tamamlandı (İnceleme başarısız)"
                      : run.status === "completed"
                        ? "Analiz tamamlandı"
                        : run.status === "running"
                          ? "Analiz ediliyor"
                          : run.status === "pending"
                            ? "Beklemede"
                            : "Başarısız"}
              </p>
            </div>
          </div>
          <ol className="space-y-3 border-l pl-5">
            {run.events.map((e) => (
              <li
                key={e.id}
                className={e.status === "failed" ? "text-destructive" : ""}
              >
                <b>
                  {e.status === "completed"
                    ? "✓"
                    : e.status === "running"
                      ? "→"
                      : "○"}{" "}
                  {e.message}
                </b>
                <time className="ml-2 text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleTimeString("tr-TR")}
                </time>
              </li>
            ))}
          </ol>
          {run.status === "failed" && (
            <p className="text-sm text-destructive">
              {labels[run.errorCode ?? ""] ?? "Analiz başarısız."}
            </p>
          )}
          {result && (
            <div className="space-y-4 rounded-lg border p-5 text-sm">
              <h3 className="font-semibold">Primary Analysis · Qwen</h3>
              <b>Analiz Özeti</b>
              <p>{String(result.summary ?? "")}</p>
              {[
                ["Root Causes", "root_causes"],
                ["Relevant Files", "relevant_files"],
                ["Implementation Plan", "implementation_plan"],
                ["Risks", "risks"],
                ["Test Plan", "test_plan"],
              ].map(([title, key]) => (
                <div key={key}>
                  <b>{title}</b>
                  <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {JSON.stringify(result[key], null, 2)}
                  </pre>
                </div>
              ))}
              <p>
                <b>Confidence:</b> {String(result.confidence ?? "")}
              </p>
            </div>
          )}
          {run.reviewer && (
            <div className="space-y-4 rounded-lg border bg-card p-5 text-sm">
              <h3 className="font-semibold">Reviewer · Kimi</h3>
              <p className="text-muted-foreground">{run.reviewer.model}</p>
              {run.reviewer.status === "running" && (
                <p role="status">İnceleme sürüyor…</p>
              )}
              {run.reviewer.status === "failed" && (
                <p role="alert" className="text-destructive">
                  reviewer_failed ·{" "}
                  {run.reviewer.errorCode === "reviewer_provider_missing"
                    ? "Kimi sağlayıcısı bağlı değil."
                    : run.reviewer.errorCode === "reviewer_invalid_response"
                      ? "Kimi geçerli inceleme sonucu döndürmedi."
                      : "Kimi incelemesi tamamlanamadı."}{" "}
                  Qwen analiziniz korunuyor.
                </p>
              )}
              {review && (
                <>
                  <div className="flex items-center gap-2">
                    <b>Verdict:</b>
                    <Badge
                      variant={
                        review.verdict === "approve"
                          ? "default"
                          : review.verdict === "needs_revision"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {verdictLabels[String(review.verdict)] ??
                        String(review.verdict)}
                    </Badge>
                  </div>
                  {[
                    ["Güçlü yönler", "strengths"],
                    ["Zayıf yönler", "weaknesses"],
                    ["Atlanan sorunlar", "missed_issues"],
                    ["Önerilen değişiklikler", "recommended_changes"],
                  ].map(([label, key]) => (
                    <div key={key}>
                      <b>{label}</b>
                      <ul className="list-disc pl-5">
                        {(review[key] as string[]).map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p>
                    <b>Risk değerlendirmesi:</b>{" "}
                    {String(review.risk_assessment)}
                  </p>
                  <p>
                    <b>Confidence:</b> {String(review.confidence)}
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
