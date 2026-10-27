import { CircleAlertIcon, CircleCheckIcon, InfoIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

type AlertTone = "info" | "success" | "warning" | "danger";

const toneStyles: Record<AlertTone, string> = {
  info: "border-[#c9d6fb] bg-secondary text-secondary-foreground",
  success: "border-[#bfe5d2] bg-success-soft text-success-text",
  warning: "border-[#f1dda8] bg-warning-soft text-warning-text",
  danger: "border-[#f3c9c6] bg-destructive-soft text-destructive-text",
};

const toneIcons: Record<AlertTone, React.ComponentType<{ className?: string }>> = {
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  danger: CircleAlertIcon,
};

function Alert({
  tone = "info",
  title,
  children,
  className,
  action,
}: {
  tone?: AlertTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const Icon = toneIcons[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed", toneStyles[tone], className)}
    >
      <Icon className="mt-0.5 size-[18px] shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div className="text-[0.875rem]">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn("animate-pulse rounded-lg bg-muted", className)} {...props} />;
}

function Spinner({ className, label = "Carregando" }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <LoaderCircleIcon aria-hidden="true" className={cn("size-5 animate-spin", className)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-input bg-card px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Icon className="size-7" />
        </div>
      ) : null}
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {description ? <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? <div className="text-sm font-semibold text-primary">{eyebrow}</div> : null}
        <h1 className="font-display text-[1.75rem] leading-tight font-extrabold sm:text-[2.125rem]">{title}</h1>
        {description ? <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export { Alert, Skeleton, Spinner, EmptyState, PageHeader };
