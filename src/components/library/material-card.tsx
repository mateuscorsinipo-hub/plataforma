import { BookmarkIcon, EyeIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { SubjectChip } from "@/components/brand/subject-chip";
import { Badge } from "@/components/ui/badge";
import { gradeLabel, materialTypeLabels } from "@/lib/config/subjects";
import type { MaterialCard as MaterialCardData } from "@/lib/data/library";
import type { Subject } from "@/lib/data/subjects";
import { cn } from "@/lib/utils";

export function formatCount(value: number): string {
  return value.toLocaleString("pt-BR", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 });
}

export function formatRating(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function MaterialCard({
  material,
  subject,
  href,
  showAuthor = true,
  actions,
}: {
  material: MaterialCardData;
  subject: Pick<Subject, "name" | "color" | "icon"> | undefined;
  href: string;
  showAuthor?: boolean;
  /** Botões extras (ficam acima do link que cobre o cartão). */
  actions?: React.ReactNode;
}) {
  const level = gradeLabel(material.schoolStage, material.gradeYear);
  return (
    <article className="group relative flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-[0_6px_24px_-12px_rgb(14_27_51/0.25)] has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/40 sm:p-5">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {subject ? <SubjectChip subject={subject} size="sm" /> : null}
          <Badge variant="neutral" className="py-0.5">
            {materialTypeLabels[material.materialType]}
          </Badge>
        </div>
        {actions ? <div className="relative z-10 -mt-1 -mr-1 flex shrink-0 items-center">{actions}</div> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="line-clamp-2 font-display text-[1.05rem] leading-snug font-bold">
          <Link href={href} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
            {material.title}
          </Link>
        </h3>
        {material.description ? <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{material.description}</p> : null}
      </div>
      {level || material.topic ? (
        <p className="line-clamp-1 text-xs font-medium text-ink-2">{[level, material.topic].filter(Boolean).join(" · ")}</p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        {showAuthor ? (
          <span className="min-w-0 truncate font-medium">{material.author ? `@${material.author.username}` : "Autor indisponível"}</span>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-3 tabular-nums">
          {material.rating !== null ? (
            <span className="flex items-center gap-1" title={`${material.ratingCount} avaliações`}>
              <StarIcon className="size-3.5 fill-current text-[#b7791f]" aria-hidden="true" />
              <span className="sr-only">Nota</span>
              {formatRating(material.rating)}
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <BookmarkIcon className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Salvamentos:</span>
            {formatCount(material.saves)}
          </span>
          <span className="flex items-center gap-1">
            <EyeIcon className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Visualizações:</span>
            {formatCount(material.views)}
          </span>
        </span>
      </div>
    </article>
  );
}

export function MaterialGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3", className)}>{children}</div>;
}
