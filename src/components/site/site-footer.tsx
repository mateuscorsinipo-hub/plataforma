import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { brand } from "@/lib/config/brand";
import { publicEnv } from "@/lib/env/public";

const footerLinks = [
  {
    title: "Produto",
    links: [
      { href: "/#recursos", label: "Recursos" },
      { href: "/biblioteca", label: "Biblioteca" },
      { href: "/planos", label: "Planos" },
      { href: "/cadastro", label: "Criar conta" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/termos", label: "Termos de uso" },
      { href: "/privacidade", label: "Política de privacidade" },
      { href: "/contato?assunto=copyright", label: "Direitos autorais" },
      { href: "/contato?assunto=privacy", label: "Pedidos sobre dados pessoais" },
    ],
  },
  {
    title: "Ajuda",
    links: [
      { href: "/contato", label: "Contato" },
      { href: "/contato?assunto=report", label: "Denunciar conteúdo" },
      { href: "/#duvidas", label: "Dúvidas frequentes" },
    ],
  },
] as const;

export function SiteFooter() {
  const { company } = publicEnv;
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex max-w-xs flex-col gap-3">
          <Logo size={30} />
          <p className="text-sm leading-relaxed text-muted-foreground">{brand.description}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {company.name ?? "[Razão social]"} · {company.document ?? "CNPJ [a definir]"}
            {company.address ? ` · ${company.address}` : null}
          </p>
          {company.contactEmail ? (
            <a className="text-sm font-semibold text-primary hover:underline" href={`mailto:${company.contactEmail}`}>
              {company.contactEmail}
            </a>
          ) : null}
        </div>
        {footerLinks.map((group) => (
          <nav key={group.title} aria-label={group.title} className="flex flex-col gap-3">
            <h2 className="text-sm font-bold">{group.title}</h2>
            <ul className="flex flex-col gap-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-ink-2 transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          Respostas e correções geradas por IA podem conter erros. Use-as como apoio ao estudo.
        </p>
      </div>
    </footer>
  );
}
