"use client";

import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { isActivePath, mobileTabs, navSections, type NavItem } from "./nav-items";

type NavLinkProps = {
  item: Pick<NavItem, "href" | "exact">;
  className: string;
  activeClassName: string;
  inactiveClassName: string;
  onNavigate?: () => void;
  children: React.ReactNode;
};

function ActiveNavLink({ item, className, activeClassName, inactiveClassName, onNavigate, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = isActivePath(pathname, item);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(className, active ? activeClassName : inactiveClassName)}
    >
      {children}
    </Link>
  );
}

/**
 * O destaque do item ativo depende da URL. Em rotas com parâmetros dinâmicos a URL
 * só existe na requisição: o Suspense deixa o resto do menu no shell estático.
 */
function NavLink(props: NavLinkProps) {
  return (
    <Suspense
      fallback={
        <Link href={props.item.href} onClick={props.onNavigate} className={cn(props.className, props.inactiveClassName)}>
          {props.children}
        </Link>
      }
    >
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
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
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                item={item}
                onNavigate={onNavigate}
                className="flex h-10 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold transition-colors"
                activeClassName="bg-secondary text-secondary-foreground"
                inactiveClassName="text-ink-2 hover:bg-muted hover:text-foreground"
              >
                <Icon className="size-[19px] shrink-0" aria-hidden="true" />
                {item.label}
              </NavLink>
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
  const [open, setOpen] = useState(false);
  return (
    <nav
      aria-label="Atalhos"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {mobileTabs.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <NavLink
                item={item}
                className="flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold"
                activeClassName="text-primary"
                inactiveClassName="text-muted-foreground"
              >
                <Icon className="size-[22px]" aria-hidden="true" />
                {item.label}
              </NavLink>
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
