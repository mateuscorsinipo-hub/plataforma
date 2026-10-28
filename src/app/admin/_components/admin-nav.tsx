"use client";

import {
  BookMarkedIcon,
  FlagIcon,
  GaugeIcon,
  InboxIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean; adminOnly?: boolean };

export const adminNav: Item[] = [
  { href: "/admin", label: "Visão geral", icon: GaugeIcon, exact: true },
  { href: "/admin/moderacao", label: "Moderação", icon: ShieldCheckIcon },
  { href: "/admin/denuncias", label: "Denúncias", icon: FlagIcon },
  { href: "/admin/usuarios", label: "Usuários", icon: UsersIcon },
  { href: "/admin/contato", label: "Contato", icon: InboxIcon },
  { href: "/admin/materias", label: "Matérias", icon: BookMarkedIcon, adminOnly: true },
  { href: "/admin/configuracoes", label: "Configurações", icon: SlidersHorizontalIcon, adminOnly: true },
  { href: "/admin/auditoria", label: "Auditoria", icon: ScrollTextIcon, adminOnly: true },
];

const base = "flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold whitespace-nowrap transition-colors";
const inactive = "text-ink-2 hover:bg-muted hover:text-foreground";

function Active({ item }: { item: Item }) {
  const pathname = usePathname();
  const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(base, active ? "bg-secondary text-secondary-foreground" : inactive)}
    >
      <item.icon className="size-[18px]" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

/** Menu da administração. Itens só de admin aparecem para admins; as páginas conferem o papel de novo. */
export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav aria-label="Administração" className="flex gap-1 overflow-x-auto lg:flex-col">
      {adminNav
        .filter((item) => isAdmin || !item.adminOnly)
        .map((item) => (
          <Suspense
            key={item.href}
            fallback={
              <Link href={item.href} className={cn(base, inactive)}>
                <item.icon className="size-[18px]" aria-hidden="true" />
                {item.label}
              </Link>
            }
          >
            <Active item={item} />
          </Suspense>
        ))}
    </nav>
  );
}
