"use client";

import "katex/dist/katex.min.css";

import Markdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { cn } from "@/lib/utils";

/**
 * Renderiza texto da IA ou de estudantes. HTML bruto nunca é interpretado
 * (react-markdown sem rehype-raw), URLs perigosas são removidas e imagens externas
 * viram links (a CSP também as bloquearia).
 */
type Props = {
  content: string;
  className?: string;
  /** Números de citação válidos nesta mensagem: viram links para a lista de fontes. */
  citationNumbers?: number[];
  citationIdPrefix?: string;
};

/** "R$ 10 e R$ 20" não pode virar fórmula: escapa o cifrão de moedas antes do parser de LaTeX. */
export function prepareMarkdown(content: string, citationNumbers: number[] = []): string {
  let text = content.replace(/\b(R|US|U\$S)\$/g, "$1\\$");
  if (citationNumbers.length) {
    const valid = new Set(citationNumbers);
    text = text.replace(/\[(\d{1,2})\](?![([])/g, (match, n: string) => (valid.has(Number(n)) ? `[${n}](#fonte-${n})` : match));
  }
  return text;
}

export function MarkdownView({ content, className, citationNumbers, citationIdPrefix = "fonte" }: Props) {
  const components: Components = {
    a({ href, children }) {
      if (href?.startsWith("#fonte-")) {
        const n = href.slice("#fonte-".length);
        return (
          <a
            href={`#${citationIdPrefix}-${n}`}
            className="mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] -translate-y-0.5 items-center justify-center rounded-md bg-secondary px-1 align-middle text-[0.7rem] font-bold text-secondary-foreground no-underline hover:bg-primary hover:text-primary-foreground"
            aria-label={`Fonte ${n}`}
          >
            {children}
          </a>
        );
      }
      const external = href ? /^https?:\/\//i.test(href) : false;
      return (
        <a
          href={href}
          className="font-medium text-primary underline underline-offset-2"
          {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow ugc" } : {})}
        >
          {children}
        </a>
      );
    },
    img({ src, alt }) {
      if (typeof src !== "string" || !/^https?:\/\//i.test(src)) return null;
      return (
        <a href={src} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
          {alt || "Imagem"}
        </a>
      );
    },
  };

  return (
    <div className={cn("prose-grifo", className)}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", maxExpand: 500, maxSize: 20, trust: false }]]}
        components={components}
      >
        {prepareMarkdown(content, citationNumbers)}
      </Markdown>
    </div>
  );
}
