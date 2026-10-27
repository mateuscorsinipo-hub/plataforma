import { MailCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/feedback";

import { ResendForm } from "./resend-form";

export const metadata: Metadata = { title: "Confirme seu e-mail", robots: { index: false } };

export default function ConfirmEmailPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        <MailCheckIcon className="size-7" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold">Confirme seu e-mail</h1>
        <p className="text-[0.9375rem] leading-relaxed text-ink-2">
          Enviamos um link de confirmação para o e-mail informado. Abra a mensagem do Grifo e clique em{" "}
          <strong>Confirmar e-mail</strong>. Se não encontrar, procure na pasta de spam.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-24" />}>
        <ResendForm />
      </Suspense>
      <Link href="/entrar" className="text-sm font-semibold text-primary hover:underline">
        Já confirmei, quero entrar
      </Link>
    </div>
  );
}
