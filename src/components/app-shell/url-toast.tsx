"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

const messages: Record<string, { text: string; tone: "success" | "info" }> = {
  "bem-vindo": { text: "Tudo pronto! Este é o seu painel.", tone: "success" },
  senha: { text: "Senha atualizada.", tone: "success" },
  "conta-excluida": { text: "Sua conta foi excluída.", tone: "info" },
};

/** Mostra avisos pontuais vindos de redirecionamentos (?bem-vindo=1) e limpa a URL. */
export function UrlToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const key = Object.keys(messages).find((k) => params.has(k));
    if (!key) return;
    const message = messages[key];
    if (message) {
      if (message.tone === "success") toast.success(message.text);
      else toast(message.text);
    }
    const next = new URLSearchParams(params);
    next.delete(key);
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return null;
}
