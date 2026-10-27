import { ShieldAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Conta suspensa", robots: { index: false } };

export default function SuspendedPage() {
  return (
    <main id="conteudo" className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <Logo size={32} />
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive-soft text-destructive-text">
        <ShieldAlertIcon className="size-8" aria-hidden="true" />
      </div>
      <h1 className="font-display text-3xl font-extrabold">Sua conta está suspensa</h1>
      <p className="max-w-md text-[0.9375rem] leading-relaxed text-ink-2">
        A conta foi suspensa por violação dos termos de uso. Se acredita que houve um engano, explique o caso pelo formulário
        de contato com o assunto &quot;Ajuda com a conta&quot;.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline">
          <Link href="/contato?assunto=support">Falar com o suporte</Link>
        </Button>
        <form action={signOut}>
          <Button type="submit" variant="ghost">
            Sair
          </Button>
        </form>
      </div>
    </main>
  );
}
