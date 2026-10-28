"use client";

import { SparklesIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { grantManualPro } from "../actions";

export function GrantProDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SparklesIcon className="size-4" /> Conceder Pro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conceder Pro de cortesia</DialogTitle>
          <DialogDescription>Para bolsas, parcerias ou suporte. Não gera cobrança e fica registrado na auditoria.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            startTransition(async () => {
              const result = await grantManualPro(userId, Number.parseInt(days, 10), reason);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              toast.success(result.message ?? "Pro concedido.");
              setOpen(false);
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pro-dias">Duração (dias)</Label>
            <Input id="pro-dias" type="number" min={1} max={366} value={days} onChange={(e) => setDays(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pro-motivo">Motivo</Label>
            <Textarea id="pro-motivo" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} required />
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || reason.trim().length < 10}>
              Conceder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
