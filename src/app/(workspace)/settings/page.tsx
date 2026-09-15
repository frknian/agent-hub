import { PageHeading, Empty } from "@/components/workspace";
export default function Page() {
  return (
    <>
      <PageHeading title="Ayarlar" description="Hesap ve uygulama bilgileri." />
      <Empty text="GitHub ile giriş · Görevler yalnızca hesabına görünür. PWA kurulumu için Android’de tarayıcı menüsünden Yükle, iPhone’da Paylaş → Ana Ekrana Ekle seçeneğini kullan." />
    </>
  );
}
