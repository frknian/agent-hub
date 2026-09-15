import { PageHeading, Empty } from "@/components/workspace";
export default function Page() {
  return (
    <>
      <PageHeading title="Maliyet" description="AI kullanımına genel bakış." />
      <Empty text="Henüz AI kullanımı veya faturalandırma yok. Aylık maliyet: —" />
    </>
  );
}
