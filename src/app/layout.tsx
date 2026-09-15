import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Pwa } from "@/components/pwa";
import { ThemeProvider } from "@/components/theme-provider";
import { THEME_STORAGE_KEY } from "@/lib/theme";
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
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeScript = `(()=>{try{const key="${THEME_STORAGE_KEY}";const stored=localStorage.getItem(key);const theme=stored==="light"||stored==="dark"||stored==="system"?stored:"system";const dark=theme==="dark"||(theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);const root=document.documentElement;root.classList.toggle("dark",dark);root.dataset.themePreference=theme;root.style.colorScheme=dark?"dark":"light";const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",dark?"#101827":"#f6f8fb");}catch{}})();`;
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <meta content="#f6f8fb" name="theme-color" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <Pwa />
        </ThemeProvider>
      </body>
    </html>
  );
}
