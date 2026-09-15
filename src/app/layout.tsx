import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Pwa } from "@/components/pwa";
export const metadata: Metadata = {
  title: { default: "Agent Hub", template: "%s · Agent Hub" },
  description: "Projelerini ve görevlerini tek yerde yönet.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Agent Hub" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2563eb",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
