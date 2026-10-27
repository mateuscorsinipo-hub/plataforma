import type { Metadata } from "next";

import { PricingCards } from "@/components/landing/pricing-table";

export const metadata: Metadata = {
  title: "Planos",
  description: "Compare o plano gratuito e o Pro do Grifo.",
};

export default function PlansPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-14 sm:px-6">
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="font-display text-4xl font-extrabold">Planos</h1>
        <p className="text-[1.0625rem] leading-relaxed text-ink-2">
          Os limites abaixo valem para os recursos de inteligência artificial. O restante da plataforma não tem limite em
          nenhum dos planos.
        </p>
      </div>
      <PricingCards />
      <p className="text-sm leading-relaxed text-muted-foreground">
        Limites diários reiniciam à meia-noite no seu fuso horário; limites mensais, no primeiro dia de cada mês. Primeira
        contratação do Pro tem direito de desistência em 7 dias, com reembolso integral.
      </p>
    </div>
  );
}
