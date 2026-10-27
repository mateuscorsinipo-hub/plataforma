import { WifiOffIcon } from "lucide-react";
import type { Metadata } from "next";

import { LogoMark } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Sem conexão", robots: { index: false } };

export default function OfflinePage() {
  return (
    <main id="conteudo" className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <LogoMark size={48} />
      <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary text-primary">
        <WifiOffIcon className="size-8" aria-hidden="true" />
      </div>
      <h1 className="font-display text-3xl font-extrabold">Você está sem conexão</h1>
      <p className="max-w-sm text-[0.9375rem] leading-relaxed text-ink-2">
        Seus estudos ficam salvos no servidor. Assim que a internet voltar, recarregue a página para continuar de onde parou.
      </p>
    </main>
  );
}
