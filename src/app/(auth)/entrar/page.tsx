import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/feedback";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold">Entrar</h1>
        <p className="text-[0.9375rem] text-ink-2">Bom ter você de volta. Continue de onde parou.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-80" />}>
        <SignInForm />
      </Suspense>
      <p className="text-center text-sm text-ink-2">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-primary hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}
