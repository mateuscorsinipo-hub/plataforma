"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="p-6">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Navegação principal do site</SheetDescription>
        <Logo size={30} />
        <nav aria-label="Menu" className="mt-4 flex flex-col">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-3 text-base font-semibold text-foreground hover:bg-muted"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <Button asChild variant="outline" onClick={() => setOpen(false)}>
            <Link href="/entrar">Entrar</Link>
          </Button>
          <Button asChild onClick={() => setOpen(false)}>
            <Link href="/cadastro">Criar conta grátis</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
