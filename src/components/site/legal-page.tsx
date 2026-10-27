import type * as React from "react";

import { Alert } from "@/components/ui/feedback";

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-14 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold">{title}</h1>
        <p className="text-sm text-muted-foreground">Última atualização: {updatedAt}</p>
      </header>
      <Alert tone="warning" title="Modelo para revisão jurídica">
        Este texto descreve como a plataforma funciona tecnicamente. Antes de operar comercialmente, ele precisa ser revisado
        por um advogado e completado com os dados do controlador.
      </Alert>
      <div className="prose-grifo [&_h2]:mt-10 [&_h2]:text-2xl">{children}</div>
    </article>
  );
}
