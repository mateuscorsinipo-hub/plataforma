import { CheckIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

type ChoiceChipProps = Omit<React.ComponentProps<"input">, "type"> & {
  type?: "checkbox" | "radio";
  label: React.ReactNode;
  description?: React.ReactNode;
  chipClassName?: string;
};

/**
 * Opção selecionável com aparência de chip, baseada em input nativo
 * (acessível por teclado e enviada normalmente no formulário).
 */
function ChoiceChip({ type = "checkbox", label, description, className, chipClassName, ...props }: ChoiceChipProps) {
  return (
    <label className={cn("group relative inline-flex cursor-pointer", className)}>
      <input type={type} className="peer sr-only" {...props} />
      <span
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-xl border border-input bg-card px-4 py-2 text-[0.9375rem] font-semibold text-foreground transition-colors select-none hover:border-primary/50",
          "peer-checked:border-primary peer-checked:bg-secondary peer-checked:text-secondary-foreground peer-checked:ring-1 peer-checked:ring-primary",
          "peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/40",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          "[&>[data-check]]:hidden peer-checked:[&>[data-check]]:flex",
          chipClassName,
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {label}
          {description ? <span className="text-xs font-medium text-muted-foreground">{description}</span> : null}
        </span>
        <span data-check aria-hidden="true" className="size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="size-3.5" strokeWidth={3} />
        </span>
      </span>
    </label>
  );
}

export { ChoiceChip };
