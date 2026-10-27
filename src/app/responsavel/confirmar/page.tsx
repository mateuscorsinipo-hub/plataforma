import { CircleCheckIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { hashToken } from "@/lib/auth/guardian";
import { isServiceRoleConfigured } from "@/lib/env/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { decideGuardianConsent } from "../actions";

export const metadata: Metadata = { title: "Autorização do responsável", robots: { index: false } };

export default function GuardianConfirmPage(props: PageProps<"/responsavel/confirmar">) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-2xl items-center px-4">
          <Logo size={28} />
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-2xl px-4 py-10">
        <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
          <ConsentContent searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function ConsentContent({ searchParams }: { searchParams: PageProps<"/responsavel/confirmar">["searchParams"] }) {
  const params = await searchParams;
  const result = typeof params.resultado === "string" ? params.resultado : null;
  const token = typeof params.token === "string" ? params.token : null;

  if (result === "autorizado") {
    return (
      <Outcome icon={<CircleCheckIcon className="size-10 text-success" />} title="Autorização registrada">
        A conta foi liberada. O perfil continua privado e a publicação na comunidade segue as regras para menores. Você pode
        pedir acesso ou exclusão dos dados a qualquer momento pelo formulário de contato.
      </Outcome>
    );
  }
  if (result === "recusado") {
    return (
      <Outcome icon={<ShieldCheckIcon className="size-10 text-primary" />} title="Pedido recusado">
        A conta e os dados cadastrados foram excluídos. Nenhuma informação sobre a criança foi mantida.
      </Outcome>
    );
  }
  if (!token || result === "invalido" || !isServiceRoleConfigured()) {
    return (
      <Outcome icon={<TriangleAlertIcon className="size-10 text-warning" />} title="Link inválido ou expirado">
        Este pedido não existe, já foi respondido ou passou do prazo. Se precisar, peça para o estudante enviar um novo pedido.
      </Outcome>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: consent } = await admin
    .from("guardian_consents")
    .select("id, user_id, guardian_name, status, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!consent || consent.status !== "pending" || new Date(consent.expires_at) < new Date()) {
    return (
      <Outcome icon={<TriangleAlertIcon className="size-10 text-warning" />} title="Link inválido ou expirado">
        Este pedido não existe, já foi respondido ou passou do prazo.
      </Outcome>
    );
  }
  const { data: student } = await admin.from("profiles").select("display_name, username").eq("id", consent.user_id).maybeSingle();

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold">Pedido de autorização</h1>
        <p className="text-[0.9375rem] leading-relaxed text-ink-2">
          Olá, {consent.guardian_name}. <strong>{student?.display_name || "O estudante"}</strong> (@{student?.username}) quer
          usar o Grifo, uma plataforma de estudos com inteligência artificial.
        </p>
      </div>
      <div className="flex flex-col gap-3 text-[0.9375rem] leading-relaxed">
        <h2 className="font-bold">O que tratamos se você autorizar</h2>
        <ul className="ml-5 list-disc space-y-1.5 text-ink-2">
          <li>Nome, e-mail, data de nascimento e preferências de estudo informadas no cadastro.</li>
          <li>Arquivos, perguntas ao tutor e atividades de estudo, usados apenas para prestar o serviço.</li>
          <li>Trechos do conteúdo enviado ao provedor de IA para gerar respostas; não usamos isso para treinar modelos.</li>
        </ul>
        <h2 className="font-bold">Proteções para crianças</h2>
        <ul className="ml-5 list-disc space-y-1.5 text-ink-2">
          <li>Perfil sempre privado; no ranking aparece só o nome de usuário.</li>
          <li>Sem publicação na biblioteca, sem mensagens entre usuários e sem publicidade.</li>
          <li>Você pode pedir acesso, correção ou exclusão dos dados a qualquer momento.</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Leia a <Link href="/privacidade" className="font-semibold text-primary hover:underline">Política de privacidade</Link> completa.
        </p>
      </div>
      <Alert tone="info">Ao recusar, a conta e todos os dados cadastrados são excluídos imediatamente.</Alert>
      <div className="flex flex-col gap-2 sm:flex-row">
        <form action={decideGuardianConsent} className="flex-1">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="decision" value="grant" />
          <Button type="submit" size="lg" className="w-full">
            Autorizo o uso da conta
          </Button>
        </form>
        <form action={decideGuardianConsent} className="flex-1">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="decision" value="deny" />
          <Button type="submit" size="lg" variant="outline" className="w-full">
            Não autorizo
          </Button>
        </form>
      </div>
    </div>
  );
}

function Outcome({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-10 text-center">
      {icon}
      <h1 className="font-display text-2xl font-extrabold">{title}</h1>
      <p className="max-w-md text-[0.9375rem] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}
