import { CheckIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { comparisonRows, formatPriceBRL, plans } from "@/lib/config/plans";
import { publicEnv } from "@/lib/env/public";
import { cn } from "@/lib/utils";

export function PricingCards({ ctaFreeHref = "/cadastro", ctaProHref = "/app/assinatura" }: { ctaFreeHref?: string; ctaProHref?: string }) {
  const price = publicEnv.proPriceCents;
  const rows = comparisonRows();
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-7">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xl font-bold">{plans.free.name}</h3>
          <p className="font-display text-4xl font-extrabold">R$ 0</p>
          <p className="text-sm text-muted-foreground">{plans.free.tagline}. Sem cartão de crédito.</p>
        </div>
        <ul className="flex flex-col gap-3 text-[0.9375rem]">
          {rows.map((row) => (
            <li key={row.label} className="flex gap-2.5">
              <CheckIcon className="mt-0.5 size-[18px] shrink-0 text-success" aria-hidden="true" />
              <span>
                {row.label}: <strong className="font-semibold">{row.free}</strong>
              </span>
            </li>
          ))}
        </ul>
        <Button asChild variant="outline" size="lg" className="mt-auto">
          <Link href={ctaFreeHref}>Criar conta grátis</Link>
        </Button>
      </div>
      <div className="flex flex-col gap-6 rounded-3xl bg-foreground p-7 text-background">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl font-bold">{plans.pro.name}</h3>
            <Badge className="bg-highlight text-foreground">mais limites</Badge>
          </div>
          <p className="font-display text-4xl font-extrabold">{price ? formatPriceBRL(price) : "Em breve"}</p>
          <p className="text-sm text-[#b8c2da]">
            {price ? "por mês. Cancele quando quiser; o Pro vale até o fim do período pago." : "O pagamento ainda não está disponível."}
          </p>
        </div>
        <ul className="flex flex-col gap-3 text-[0.9375rem] text-[#e6eaf5]">
          {rows.map((row) => (
            <li key={row.label} className="flex gap-2.5">
              <CheckIcon className="mt-0.5 size-[18px] shrink-0 text-highlight" aria-hidden="true" />
              <span>
                {row.label}: <strong className="font-semibold text-white">{row.pro}</strong>
              </span>
            </li>
          ))}
        </ul>
        <Button
          asChild={Boolean(price)}
          size="lg"
          disabled={!price}
          className={cn("mt-auto bg-white text-foreground hover:bg-white/90")}
        >
          {price ? <Link href={ctaProHref}>Assinar o Pro</Link> : <span>Indisponível no momento</span>}
        </Button>
      </div>
    </div>
  );
}
