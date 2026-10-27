import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold">Criar conta grátis</h1>
        <p className="text-[0.9375rem] text-ink-2">Leva um minuto. Depois, contamos o que você estuda para montar seu painel.</p>
      </div>
      <SignUpForm />
      <p className="text-center text-sm text-ink-2">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
