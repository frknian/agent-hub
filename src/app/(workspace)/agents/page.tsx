import { PageHeading, Empty } from "@/components/workspace";
export default function Page() {
  return (
    <>
      <PageHeading title="Agentlar" description="Gelecekteki çalışma alanın." />
      <Empty text="AI agent çalıştırma bu milestone kapsamında etkin değil." />
    </>
  );
}
