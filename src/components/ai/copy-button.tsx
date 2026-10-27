"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2.5 text-muted-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          toast.error("Não foi possível copiar. Selecione o texto manualmente.");
        }
      }}
    >
      {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      {copied ? "Copiado" : label}
    </Button>
  );
}
