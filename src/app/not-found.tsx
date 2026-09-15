import Link from "next/link";
export default function NotFound() {
  return (
    <main className="p-10">
      <h1 className="text-xl font-semibold">Sayfa bulunamadı</h1>
      <Link className="mt-4 inline-block text-primary" href="/dashboard">
        Dashboard’a dön
      </Link>
    </main>
  );
}
