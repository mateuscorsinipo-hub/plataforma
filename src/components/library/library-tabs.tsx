import { BookmarkIcon, CompassIcon, HeartIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

const tabs = [
  { key: "explorar", href: "/app/biblioteca", label: "Explorar", icon: CompassIcon },
  { key: "salvos", href: "/app/biblioteca/salvos", label: "Salvos", icon: BookmarkIcon },
  { key: "favoritos", href: "/app/biblioteca/favoritos", label: "Favoritos", icon: HeartIcon },
] as const;

export function LibraryTabs({ active }: { active: (typeof tabs)[number]["key"] }) {
  return (
    <nav aria-label="Seções da biblioteca" className="flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1 sm:w-fit">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold whitespace-nowrap transition-colors sm:flex-none",
            tab.key === active ? "bg-card text-foreground shadow-sm" : "text-ink-2 hover:text-foreground",
          )}
        >
          <tab.icon className="size-4" aria-hidden="true" />
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
