import { HourglassIcon } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { GuardianInviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Aguardando autorização", robots: { index: false } };

export default function PendingGuardianPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <Logo size={28} />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sair
            </Button>
          </form>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-2xl px-4 py-10">
        <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
          <PendingContent />
        </Suspense>
      </main>
    </div>
  );
}

async function PendingContent() {
  const user = await requireUser("/responsavel/pendente");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/entrar?erro=perfil");
  if (profile.account_status === "active") redirect(profile.onboarding_completed_at ? "/app" : "/onboarding");

  const supabase = await createSupabaseServerClient();
  const { data: latest } = await supabase
    .from("guardian_consents")
    .select("status, guardian_email, requested_at, expires_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const pending = latest?.status === "pending" && new Date(latest.expires_at) > new Date();
  const maskedEmail = latest?.guardian_email ? latest.guardian_email.replace(/^(.).*(@.*)$/, "$1•••$2") : null;

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-warning-soft text-warning-text">
        <HourglassIcon className="size-7" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold">Falta a autorização do responsável</h1>
        <p className="text-[0.9375rem] leading-relaxed text-ink-2">
          Para quem tem menos de 12 anos, a conta só é liberada depois que um dos pais ou responsável legal autoriza. Isso
          protege seus dados, como prevê a LGPD.
        </p>
      </div>
      {pending ? (
        <p className="rounded-2xl bg-background p-4 text-[0.9375rem] leading-relaxed">
          Enviamos o pedido para <strong>{maskedEmail}</strong>. Assim que o responsável autorizar, é só entrar de novo.
        </p>
      ) : null}
      <GuardianInviteForm hasPending={pending} />
    </div>
  );
}
