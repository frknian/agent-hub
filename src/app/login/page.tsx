import { AuthButton } from "@/components/auth-button";
import { Card, CardContent } from "@/components/ui/card";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-8">
          <p className="text-sm font-bold text-primary">AGENT HUB</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Çalışma alanına hoş geldin.
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Projelerin, görevlerin ve sonraki adımların. Hepsi tek bir yerde.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              Giriş tamamlanamadı. Erişim iznini ve sunucu yapılandırmasını
              kontrol edin.
            </p>
          )}
          <AuthButton />
          <p className="text-xs text-muted-foreground">
            GitHub ile güvenli giriş · Depo yazma izni istenmez
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
