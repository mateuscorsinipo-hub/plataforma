import type * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: string | string[] | null;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * Agrupa rótulo, ajuda e erro de um campo. O controle filho deve usar o mesmo
 * `id` e `aria-describedby={describedBy(id, ...)}` — use `fieldA11y` para isso.
 */
function Field({ id, label, description, error, optional, className, children }: FieldProps) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div data-slot="field" className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground">(opcional)</span> : null}
      </Label>
      {children}
      {description && !message ? (
        <p id={`${id}-description`} className="text-[0.8125rem] leading-snug text-muted-foreground">
          {description}
        </p>
      ) : null}
      {message ? (
        <p id={`${id}-error`} role="alert" className="text-[0.8125rem] leading-snug font-medium text-destructive-text">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function fieldA11y(id: string, error?: string | string[] | null, hasDescription = false) {
  const invalid = Boolean(Array.isArray(error) ? error.length : error);
  const describedBy = invalid ? `${id}-error` : hasDescription ? `${id}-description` : undefined;
  return {
    id,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
  } as const;
}

export { Field, fieldA11y };
