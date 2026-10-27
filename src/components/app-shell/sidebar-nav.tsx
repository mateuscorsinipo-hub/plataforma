"use client";

import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { isActivePath, mobileTabs, navSections } from "./nav-items";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Áreas do app" className="flex flex-col gap-5">
      {navSections.map((section) => (
        <div key={section.title ?? "principal"} className="flex flex-col gap-0.5">
          {section.title ? (
            <p className="px-3 pb-1.5 text-[0.6875rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              {section.title}
            </p>
          ) : null}
          {section.items.map((item) => {
            const active = isActivePath(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold transition-colors",
                  active ? "bg-secondary text-secondary-foreground" : "text-ink-2 hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-[19px] shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function SidebarNav() {
  return <NavList />;
}

export function MobileTabBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <nav
      aria-label="Atalhos"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {mobileTabs.map((item) => {
          const active = isActivePath(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-[22px]" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="flex h-16 w-full cursor-pointer flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold text-muted-foreground">
              <EllipsisIcon className="size-[22px]" aria-hidden="true" />
              Mais
            </SheetTrigger>
            <SheetContent side="left" className="overflow-y-auto p-5">
              <SheetTitle className="sr-only">Menu do app</SheetTitle>
              <SheetDescription className="sr-only">Todas as áreas do Grifo</SheetDescription>
              <Logo size={28} />
              <NavList onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
