import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        neutral: "bg-muted text-ink-2",
        success: "bg-success-soft text-success-text",
        warning: "bg-warning-soft text-warning-text",
        danger: "bg-destructive-soft text-destructive-text",
        streak: "bg-streak-soft text-streak-text",
        dark: "bg-foreground text-background",
        outline: "border border-border bg-card text-ink-2",
      },
      shape: {
        pill: "rounded-full",
        tag: "rounded-lg",
      },
    },
    defaultVariants: { variant: "default", shape: "pill" },
  },
);

function Badge({
  className,
  variant,
  shape,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, shape }), className)} {...props} />;
}

function StatusDot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("size-1.5 rounded-full bg-current", className)} />;
}

export { Badge, StatusDot, badgeVariants };
