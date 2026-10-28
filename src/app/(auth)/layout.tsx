import { CheckIcon } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";

const points = [
  "Resumos, flashcards e quizzes a partir do seu material",
  "Plano de estudos com tarefas diárias até a prova",
  "Tutor que explica o raciocínio, em português",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <Link href="/" className="w-fit rounded-lg" aria-label="Grifo, página inicial">
          <Logo inverted size={34} />
        </Link>
        <div className="flex max-w-md flex-col gap-6">
          <p className="font-display text-[2.6rem] leading-[1.05] font-extrabold tracking-[-0.03em]">
            Estude com o material que você <span className="text-highlight">já tem.</span>
          </p>
          <ul className="flex flex-col gap-3 text-[1.0625rem] text-[#dce5ff]">
            {points.map((point) => (
              <li key={point} className="flex gap-3">
                <CheckIcon className="mt-1 size-5 shrink-0 text-highlight" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-[#e3eaff]">Respostas de IA podem conter erros. Confira informações importantes.</p>
      </aside>
      <main id="conteudo" className="flex flex-col items-center px-4 py-10 sm:px-8 lg:justify-center">
        <Link href="/" className="mb-10 rounded-lg lg:hidden" aria-label="Grifo, página inicial">
          <Logo size={32} />
        </Link>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
