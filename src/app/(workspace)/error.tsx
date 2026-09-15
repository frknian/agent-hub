"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Çalışma alanı yüklenemedi</h1>
      <p className="text-sm text-muted-foreground">
        Lütfen tekrar deneyin. Sorun sürerse sunucu ve veritabanı
        yapılandırmasını kontrol edin.
      </p>
      <Button onClick={reset}>Tekrar dene</Button>
    </div>
  );
}
