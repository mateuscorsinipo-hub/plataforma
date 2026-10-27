import type { MetadataRoute } from "next";

import { brand } from "@/lib/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${brand.name} — ${brand.shortDescription}`,
    short_name: brand.name,
    description: brand.description,
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6F7FB",
    theme_color: brand.themeColor,
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Revisar flashcards", url: "/app/flashcards/revisar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Perguntar ao tutor", url: "/app/tutor", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Plano de hoje", url: "/app/plano", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
