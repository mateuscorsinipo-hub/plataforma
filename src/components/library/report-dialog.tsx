"use client";

import { FlagIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { reportMaterial } from "@/app/(public)/biblioteca/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/primitives";
import { reportReasonLabels } from "@/lib/validation/materials";

export function ReportDialog({
  materialId,
  materialUrl,
  alreadyReported,
  onReported,
}: {
  materialId: string;
  materialUrl: string;
  alreadyReported: boolean;
  onReported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await reportMaterial({ materialId, reason, details });
      if (result.ok) {
        toast.success("Denúncia enviada. A moderação vai analisar.");
        onReported();
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (alreadyReported) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <FlagIcon className="size-4" /> Denúncia enviada
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <FlagIcon className="size-4" /> Denunciar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Denunciar material</DialogTitle>
          <DialogDescription>Quem publicou não fica sabendo quem denunciou. Use a denúncia para problemas reais no conteúdo.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">Qual é o problema?</legend>
            <RadioGroup value={reason} onValueChange={setReason} aria-label="Motivo da denúncia">
              {Object.entries(reportReasonLabels).map(([value, label]) => (
                <div key={value} className="flex items-center gap-3">
                  <RadioGroupItem value={value} id={`motivo-${value}`} />
                  <Label htmlFor={`motivo-${value}`} className="cursor-pointer font-medium">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>
          {reason === "copyright" ? (
            <Alert tone="info">
              Se você é titular dos direitos, envie também a{" "}
              <Link className="font-semibold underline" href={`/contato?assunto=copyright&url=${encodeURIComponent(materialUrl)}`}>
                notificação de direitos autorais
              </Link>{" "}
              com seus dados para contato.
            </Alert>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="detalhes-denuncia">
              Detalhes {reason === "other" ? "" : <span className="font-normal text-muted-foreground">(opcional)</span>}
            </Label>
            <Textarea
              id="detalhes-denuncia"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Conte o que está errado e, se possível, onde."
            />
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !reason}>
              Enviar denúncia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
