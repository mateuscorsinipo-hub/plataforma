import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/feedback";
import { publicEnv } from "@/lib/env/public";

import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fale com o Grifo: suporte, dados pessoais, direitos autorais e denúncias.",
};

export default function ContactPage() {
  const { company } = publicEnv;
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl font-extrabold">Contato</h1>
        <p className="text-[1.0625rem] leading-relaxed text-ink-2">
          Use o formulário para suporte, pedidos sobre seus dados pessoais, notificações de direitos autorais ou denúncias.
          Cada assunto vai para a fila certa.
        </p>
        <div className="flex flex-col gap-2 rounded-2xl bg-background p-5 text-sm leading-relaxed text-ink-2">
          <p>
            <strong className="text-foreground">Direitos autorais:</strong> materiais denunciados ficam indisponíveis durante a
            análise quando há indícios claros de violação.
          </p>
          <p>
            <strong className="text-foreground">Dados pessoais:</strong> também é possível exportar ou excluir sua conta direto
            nas configurações do app.
          </p>
          {company.contactEmail ? (
            <p>
              <strong className="text-foreground">E-mail:</strong>{" "}
              <a href={`mailto:${company.contactEmail}`} className="font-semibold text-primary hover:underline">
                {company.contactEmail}
              </a>
            </p>
          ) : null}
        </div>
      </div>
      <Suspense fallback={<Skeleton className="h-[520px] rounded-2xl" />}>
        <ContactForm />
      </Suspense>
    </div>
  );
}
