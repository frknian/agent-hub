import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Agent Hub",
    short_name: "Agent Hub",
    description: "Projeler ve görevler için çalışma alanı",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f6f8fb",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
