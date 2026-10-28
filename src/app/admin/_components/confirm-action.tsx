"use client";

import type * as React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Result = { ok: true; message?: string } | { ok: false; error: string };

/**
 * Botão de decisão administrativa com confirmação. Quando `noteLabel` é informado,
 * o motivo é obrigatório (vai para o autor e para a auditoria).
 */
export function ConfirmAction({
  label,
  title,
  description,
  confirmLabel,
  noteLabel,
  notePlaceholder,
  variant = "outline",
  size = "sm",
  action,
}: {
  label: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  noteLabel?: string;
  notePlaceholder?: string;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  size?: "sm" | "default";
  action: (note?: string) => Promise<Result>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await action(noteLabel ? note : undefined);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message ?? "Feito.");
      setOpen(false);
      setNote("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {noteLabel ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo-decisao">{noteLabel}</Label>
            <Textarea
              id="motivo-decisao"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={notePlaceholder}
            />
          </div>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive-solid" : "default"}
            disabled={pending || (Boolean(noteLabel) && note.trim().length < 10)}
            onClick={confirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
