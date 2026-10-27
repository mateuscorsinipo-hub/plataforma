import type { Metadata, Viewport } from "next";

import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { TooltipProvider } from "@/components/ui/primitives";
import { Toaster } from "@/components/ui/toaster";
import { brand } from "@/lib/config/brand";
import { publicEnv } from "@/lib/env/public";

import { bricolage, figtree } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: `${brand.name} — ${brand.shortDescription}`,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: brand.name,
    title: `${brand.name} — ${brand.shortDescription}`,
    description: brand.description,
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: brand.themeColor,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" className={`${figtree.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#conteudo"
          className="sr-only z-[100] rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Pular para o conteúdo
        </a>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
