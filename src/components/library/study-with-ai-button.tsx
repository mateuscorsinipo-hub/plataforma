"use client";

import { LoaderCircleIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { studyMaterialWithAI } from "@/app/app/biblioteca/actions";
import { Button } from "@/components/ui/button";

/** Copia o material para os arquivos de estudo e abre o Estúdio com ele já escolhido. */
export function StudyWithAIButton({ slug, loginHref }: { slug: string; loginHref: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (loginHref) {
    return (
      <Button asChild size="sm">
        <Link href={loginHref}>
          <SparklesIcon className="size-4" /> Estudar com IA
        </Link>
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await studyMaterialWithAI(slug);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          if (result.warning) toast.warning(result.warning);
          router.push(`/app/estudio?arquivos=${result.fileIds.join(",")}`);
        })
      }
    >
      {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
      {pending ? "Preparando…" : "Estudar com IA"}
    </Button>
  );
}
