import { ThemeSwitcher } from "@/components/theme-switcher";
import { PageHeading } from "@/components/workspace";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
export default function Page() {
  return (
    <>
      <PageHeading title="Ayarlar" description="Hesap ve uygulama bilgileri." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="font-semibold">Görünüm</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tercihin cihazlarında saklanır. Sistem seçeneği işletim sistemi
                temasını takip eder.
              </p>
            </div>
            <ThemeSwitcher />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="font-semibold">AI sağlayıcıları</h2>
            <p className="text-sm text-muted-foreground">
              Qwen, Kimi ve OpenAI anahtarlarını yalnızca sizin hesabınıza bağlı
              olarak saklayın.
            </p>
            <Link
              className="text-sm font-medium text-primary hover:underline"
              href="/settings/providers"
            >
              Sağlayıcıları yönet
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="font-semibold">Agent sistemi</h2>
            <p className="text-sm text-muted-foreground">
              Balanced Developer yönlendirmesini veya kendi rol yapılandırmanızı
              seçin.
            </p>
            <Link
              className="text-sm font-medium text-primary hover:underline"
              href="/settings/agent-system"
            >
              Agent sistemini ayarla
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-sm leading-6 text-muted-foreground">
            GitHub ile giriş · Görevler yalnızca hesabına görünür. PWA kurulumu
            için Android’de tarayıcı menüsünden Yükle, iPhone’da Paylaş → Ana
            Ekrana Ekle seçeneğini kullan.
          </CardContent>
        </Card>
      </div>
    </>
  );
}
