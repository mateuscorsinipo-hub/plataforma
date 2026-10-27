import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/site/mobile-nav";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";

export const siteNavLinks = [
  { href: "/#recursos", label: "Recursos" },
  { href: "/#tutor", label: "Tutor de IA" },
  { href: "/biblioteca", label: "Biblioteca" },
  { href: "/planos", label: "Planos" },
  { href: "/#duvidas", label: "Dúvidas" },
] as const;

function GuestActions() {
  return (
    <>
      <Button asChild variant="ghost" className="hidden sm:inline-flex">
        <Link href="/entrar">Entrar</Link>
      </Button>
      <Button asChild>
        <Link href="/cadastro">Criar conta</Link>
      </Button>
    </>
  );
}

async function AccountActions() {
  const user = await getSessionUser();
  if (!user) return <GuestActions />;
  return (
    <Button asChild>
      <Link href="/app">Ir para o painel</Link>
    </Button>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-lg" aria-label="Grifo, página inicial">
          <Logo size={32} />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-6 text-[0.9375rem] font-medium lg:flex">
          {siteNavLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-ink-2 transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Suspense fallback={<GuestActions />}>
            <AccountActions />
          </Suspense>
          <MobileNav links={siteNavLinks.map((l) => ({ href: l.href, label: l.label }))} />
        </div>
      </div>
    </header>
  );
}
