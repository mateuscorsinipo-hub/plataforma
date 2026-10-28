import {
  BookOpenIcon,
  CalendarDaysIcon,
  ChartColumnIcon,
  CheckIcon,
  FileTextIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TimerIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PricingCards } from "@/components/landing/pricing-table";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/config/brand";

export const metadata: Metadata = {
  title: { absolute: `${brand.name} — estudos com IA, do caderno ao dia da prova` },
  description: brand.description,
};

const features = [
  {
    icon: MessageCircleIcon,
    title: "Tutor de IA",
    text: "Tira dúvidas de qualquer matéria, passo a passo, e propõe exercícios parecidos para você praticar.",
  },
  {
    icon: FileTextIcon,
    title: "Estúdio de estudos",
    text: "Resumos, guias, glossários, conceitos-chave, flashcards e quizzes a partir do seu próprio material.",
  },
  {
    icon: TimerIcon,
    title: "Simulados com tempo",
    text: "Treine no formato da prova, salve o progresso e veja seus pontos fracos por matéria.",
  },
  {
    icon: CalendarDaysIcon,
    title: "Plano e calendário",
    text: "Tarefas diárias com duração estimada, ajustadas ao tempo que você tem até a prova.",
  },
  {
    icon: BookOpenIcon,
    title: "Biblioteca da comunidade",
    text: "Materiais publicados por estudantes, com moderação e canal de denúncia.",
  },
  {
    icon: ChartColumnIcon,
    title: "Progresso de verdade",
    text: "Tempo estudado, acertos por matéria e o que precisa de revisão, calculados da sua atividade.",
  },
] as const;

const faqs = [
  {
    q: "A IA pode errar?",
    a: "Pode. Respostas e correções automáticas são apoio ao estudo, não verdade final. Quando você envia um documento, mostramos as páginas usadas; correções de dissertativas aparecem marcadas como avaliações automatizadas.",
  },
  {
    q: "Meus arquivos ficam públicos?",
    a: "Não. Arquivos enviados ao estúdio são privados e só você acessa. Vai para a biblioteca apenas o que você decidir publicar, depois da moderação.",
  },
  {
    q: "Tenho menos de 18 anos. Posso usar?",
    a: "Sim, a partir de 12 anos (abaixo disso, só com autorização de um responsável). Contas de menores começam com o perfil privado e o responsável pode pedir acesso ou a exclusão dos dados.",
  },
  {
    q: "Posso usar materiais de cursinhos ou livros?",
    a: "Para estudar sozinho, sim: seus arquivos são privados. Para publicar na biblioteca, o material precisa ser seu ou você precisa ter autorização. Conteúdo que viole direitos autorais é removido quando denunciado.",
  },
  {
    q: "Como funciona o plano gratuito?",
    a: "Você usa biblioteca, flashcards, quizzes, plano e calendário sem limite. Os recursos de IA têm uma cota mensal ou diária, mostrada na página de assinatura.",
  },
  {
    q: "Como cancelo o Pro?",
    a: "Na página de assinatura, a qualquer momento. Você mantém o Pro até o fim do período já pago.",
  },
] as const;

export default function LandingPage() {
  return (
    <>
      <section className="bg-background">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div className="flex flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground">
              <SparklesIcon className="size-4" aria-hidden="true" />
              Plataforma de estudos com IA
            </span>
            <h1 className="font-display text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.035em] sm:text-6xl">
              Do caderno ao dia da prova, com foco <span className="grifo">no que importa.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-ink-2">
              Envie suas anotações, PDFs e slides. O Grifo cria resumos, flashcards e simulados, monta um plano até a
              data da prova e tem um tutor que explica o raciocínio em vez de só entregar a resposta.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/cadastro">Começar grátis</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/biblioteca">Explorar a biblioteca</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Plano gratuito sem cartão de crédito. Para estudantes a partir de {brand.minimumAge} anos.
            </p>
          </div>
          <HeroPreview />
        </div>
      </section>

      <section id="recursos" className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="font-display text-3xl leading-tight font-extrabold sm:text-[2.6rem]">
            Um lugar para o estudo inteiro, não só para a véspera
          </h2>
          <p className="text-lg leading-relaxed text-ink-2">
            As ferramentas conversam entre si: o que você erra no quiz vira revisão no plano, e o plano sabe quanto tempo
            falta para a prova.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex flex-col gap-3 rounded-2xl border border-border p-6">
              <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="size-[22px]" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="text-[0.9375rem] leading-relaxed text-ink-2">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="tutor" className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className="text-sm font-bold tracking-[0.08em] text-primary uppercase">Tutor de IA</span>
          <h2 className="font-display text-3xl leading-tight font-extrabold sm:text-[2.5rem]">Um tutor que pergunta de volta</h2>
          <p className="text-[1.0625rem] leading-relaxed text-ink-2">
            Peça uma explicação simples ou aprofundada, a resolução passo a passo ou uma analogia. Quando você envia um
            documento, as respostas indicam as páginas usadas. Se o material não cobre a pergunta, o tutor avisa.
          </p>
          <ul className="flex flex-col gap-2.5 text-[0.9375rem]">
            {[
              "Conversas separadas por matéria, com histórico",
              "Envio de foto do exercício ou de PDF",
              "Respostas em português, com o raciocínio explicado",
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <CheckIcon className="mt-0.5 size-5 text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 rounded-3xl bg-background p-5" aria-label="Exemplo de conversa com o tutor">
          <p className="max-w-[80%] self-end rounded-[18px_18px_4px_18px] bg-primary px-4 py-3 text-[0.9375rem] leading-relaxed text-primary-foreground">
            Não entendi por que Δ = b² − 4ac decide quantas raízes a equação tem.
          </p>
          <div className="flex max-w-[90%] flex-col gap-2 self-start rounded-[18px_18px_18px_4px] border border-border bg-card px-4 py-3.5 text-[0.9375rem] leading-relaxed">
            <p>
              Boa pergunta para entender, não decorar. A fórmula de Bhaskara tem <strong>√Δ</strong> no meio:
            </p>
            <p className="rounded-lg bg-background px-3 py-2 font-mono text-sm">x = (−b ± √Δ) / 2a</p>
            <p>
              Se Δ for negativo, não existe raiz real de um número negativo. Antes de eu continuar: o que você acha que
              acontece quando Δ = 0?
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Explique mais simples", "Me dê um exercício", "Mostre o passo a passo"].map((chip) => (
              <span key={chip} className="rounded-full border border-input bg-card px-3 py-1.5 text-[0.8125rem] font-semibold">
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6">
          <div className="flex max-w-2xl flex-col gap-3">
            <span className="text-sm font-bold tracking-[0.08em] text-primary uppercase">Resumos, flashcards e quizzes</span>
            <h2 className="font-display text-3xl leading-tight font-extrabold sm:text-[2.5rem]">
              Seu material vira prática em minutos
            </h2>
            <p className="text-[1.0625rem] leading-relaxed text-ink-2">
              Escolha a dificuldade, o tamanho e a quantidade de perguntas. Tudo pode ser editado antes de salvar e
              exportado depois.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
              <h3 className="text-lg font-bold">Resumos e guias</h3>
              <p className="text-[0.9375rem] leading-relaxed text-ink-2">
                Rápido ou detalhado, com conceitos-chave, glossário e perguntas dissertativas.
              </p>
              <div className="flex flex-col gap-1.5 pt-1" aria-hidden="true">
                <span className="h-2 w-[90%] rounded bg-border" />
                <span className="h-2 w-[76%] rounded bg-highlight-soft" />
                <span className="h-2 w-[84%] rounded bg-border" />
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
              <h3 className="text-lg font-bold">Flashcards com repetição espaçada</h3>
              <p className="text-[0.9375rem] leading-relaxed text-ink-2">
                O agendador traz de volta primeiro o que você tem mais dificuldade de lembrar.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1" aria-hidden="true">
                <span className="rounded-lg bg-destructive-soft px-2.5 py-1 text-xs font-bold text-destructive-text">Errei</span>
                <span className="rounded-lg bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning-text">Difícil</span>
                <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">Bom</span>
                <span className="rounded-lg bg-success-soft px-2.5 py-1 text-xs font-bold text-success-text">Fácil</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
              <h3 className="text-lg font-bold">Quizzes com explicação</h3>
              <p className="text-[0.9375rem] leading-relaxed text-ink-2">
                Múltipla escolha, verdadeiro ou falso e questões abertas, com relatório dos erros recorrentes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div className="order-2 flex flex-col gap-3.5 rounded-3xl border border-border p-5 lg:order-1" aria-label="Exemplo de plano de estudos">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <strong className="text-[1.0625rem]">Plano: ENEM · Ciências da Natureza</strong>
            <span className="text-sm font-bold text-secondary-foreground">exemplo</span>
          </div>
          {[
            { t: "Ler: ecologia, cadeias alimentares", m: "25 min", done: true },
            { t: "Flashcards: citologia", m: "15 min", done: false },
            { t: "Revisão prioritária: estequiometria", m: "alta", done: false, hi: true },
          ].map((task) => (
            <div
              key={task.t}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${task.hi ? "bg-warning-soft" : "bg-background"}`}
            >
              <span
                className={`flex size-[22px] items-center justify-center rounded-md ${task.done ? "bg-primary" : "border-2 border-[#a9beff]"}`}
                aria-hidden="true"
              >
                {task.done ? <CheckIcon className="size-3.5 text-white" strokeWidth={3} /> : null}
              </span>
              <span className={`flex-1 text-[0.9375rem] ${task.done ? "text-muted-foreground line-through" : ""}`}>{task.t}</span>
              <span className={`text-[0.8125rem] ${task.hi ? "font-semibold text-warning-text" : "text-muted-foreground"}`}>{task.m}</span>
            </div>
          ))}
        </div>
        <div className="order-1 flex flex-col gap-4 lg:order-2">
          <span className="text-sm font-bold tracking-[0.08em] text-primary uppercase">Planos de estudo</span>
          <h2 className="font-display text-3xl leading-tight font-extrabold sm:text-[2.5rem]">
            Um cronograma que se ajusta quando a semana aperta
          </h2>
          <p className="text-[1.0625rem] leading-relaxed text-ink-2">
            Informe a prova, a data, as matérias e o tempo que você tem por dia. O plano distribui leitura, exercícios,
            flashcards e simulados, e reorganiza as tarefas quando você remarca ou erra um assunto.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex max-w-2xl flex-col gap-3">
              <span className="text-sm font-bold tracking-[0.08em] text-primary uppercase">Comunidade</span>
              <h2 className="font-display text-3xl leading-tight font-extrabold sm:text-[2.5rem]">
                Materiais feitos por quem também está estudando
              </h2>
              <p className="text-[1.0625rem] leading-relaxed text-ink-2">
                Publique seus resumos e encontre os de outras pessoas por matéria, série e tema. Todo material passa pelas
                regras de moderação e pode ser denunciado.
              </p>
            </div>
            <Button asChild variant="outline" size="lg">
              <Link href="/biblioteca">Abrir a biblioteca</Link>
            </Button>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 text-[0.9375rem] leading-relaxed text-ink-2">
            <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p>
              Só é publicado o que o autor declara ser dele ou ter autorização para compartilhar. Detentores de direitos
              podem pedir a remoção pelo{" "}
              <Link href="/contato?assunto=copyright" className="font-semibold text-primary underline-offset-4 hover:underline">
                formulário de direitos autorais
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6">
        <h2 className="font-display text-3xl leading-tight font-extrabold sm:text-[2.5rem]">Como funciona</h2>
        <ol className="grid gap-8 md:grid-cols-3">
          {[
            { t: "Conte o que você estuda", d: "Série, matérias, objetivos e datas de provas. Leva dois minutos e dá para pular." },
            { t: "Traga seu material", d: "PDF, slides, documentos, fotos do caderno ou texto colado. Organize em pastas." },
            { t: "Pratique todo dia", d: "Siga o plano, revise os flashcards do dia e acompanhe a evolução por matéria." },
          ].map((step, index) => (
            <li key={step.t} className="flex flex-col gap-2.5">
              <span className="font-display text-5xl font-extrabold text-primary" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="text-lg font-bold">{step.t}</h3>
              <p className="text-[0.9375rem] leading-relaxed text-ink-2">{step.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="planos" className="bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6">
          <div className="flex max-w-2xl flex-col gap-3">
            <h2 className="font-display text-3xl leading-tight font-extrabold sm:text-[2.5rem]">Planos</h2>
            <p className="text-[1.0625rem] leading-relaxed text-ink-2">
              O gratuito cobre o estudo do dia a dia. O Pro amplia os limites de IA e de processamento de arquivos.
            </p>
          </div>
          <PricingCards />
        </div>
      </section>

      <section id="duvidas" className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-20 sm:px-6">
        <h2 className="font-display text-3xl leading-tight font-extrabold sm:text-[2.5rem]">Dúvidas frequentes</h2>
        {faqs.map((item, index) => (
          <details key={item.q} className="group rounded-2xl border border-border px-5 py-4" open={index === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[1.0625rem] font-bold">
              {item.q}
              <span aria-hidden="true" className="text-xl text-muted-foreground transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">{item.a}</p>
          </details>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col items-center gap-5 rounded-[28px] bg-primary px-6 py-14 text-center text-primary-foreground">
          <h2 className="font-display text-3xl leading-tight font-extrabold sm:text-[2.6rem]">
            Comece pelo material que você já tem
          </h2>
          <p className="max-w-xl text-[1.0625rem] leading-relaxed text-[#dce5ff]">
            Crie sua conta, envie um PDF ou uma foto do caderno e veja o primeiro resumo ficar pronto.
          </p>
          <Button asChild size="lg" className="bg-white font-extrabold text-secondary-foreground hover:bg-white/90">
            <Link href="/cadastro">Criar conta grátis</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function HeroPreview() {
  return (
    <div className="flex flex-col gap-3.5" aria-label="Exemplo do estúdio transformando um PDF em material de estudo">
      <div className="flex items-center gap-3.5 rounded-[20px] border border-border bg-card p-4 shadow-float">
        <div className="flex h-14 w-12 items-center justify-center rounded-xl bg-destructive-soft text-xs font-extrabold text-destructive-text">
          PDF
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <strong className="text-[0.9375rem]">Citologia — aula 4.pdf</strong>
          <span className="text-[0.8125rem] text-muted-foreground">12 páginas · texto extraído</span>
        </div>
        <span className="rounded-lg bg-success-soft px-2.5 py-1 text-xs font-bold text-success-text">Pronto</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2.5 rounded-[18px] border border-border bg-card p-4">
          <span className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Resumo</span>
          <p className="text-sm leading-relaxed">
            A <span className="grifo-soft">mitocôndria</span> realiza a respiração celular e produz ATP.
          </p>
          <span className="text-xs text-muted-foreground">Fonte: p. 3</span>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[18px] bg-primary p-4 text-primary-foreground">
          <span className="text-xs font-bold tracking-[0.06em] text-[#e3eaff] uppercase">Flashcard</span>
          <p className="text-[0.9375rem] leading-snug font-bold">Onde ocorre a síntese de proteínas?</p>
          <span className="text-xs text-[#e3eaff]">12 cartões · revisão amanhã</span>
        </div>
        <div className="flex flex-col gap-2 rounded-[18px] border border-border bg-card p-4">
          <span className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Quiz</span>
          <p className="text-sm leading-snug">Qual organela tem DNA próprio?</p>
          <span className="rounded-lg border-2 border-success bg-success-soft px-2.5 py-1.5 text-[0.8125rem] font-semibold text-success-text">
            C) Mitocôndria
          </span>
        </div>
      </div>
    </div>
  );
}
