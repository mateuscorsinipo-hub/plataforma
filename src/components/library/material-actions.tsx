"use client";

import { BookmarkIcon, HeartIcon, PencilIcon, Share2Icon, StarIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type * as React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { rateMaterial, toggleMaterialSave } from "@/app/(public)/biblioteca/actions";
import { ReportDialog } from "@/components/library/report-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ViewerState = { favorite: boolean; saved: boolean; rating: number | null; reported: boolean };

type Props = {
  materialId: string;
  title: string;
  shareUrl: string;
  loginHref: string;
  editHref: string | null;
  /** null: visitante sem conta. */
  viewer: ViewerState | null;
  isAuthor: boolean;
  /** Só materiais publicados podem ser salvos, avaliados e denunciados. */
  published: boolean;
  /** Ação principal exibida antes das demais (na mesma linha). */
  leading?: React.ReactNode;
};

async function shareLink(title: string, url: string) {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado.");
  } catch {
    toast.error("Não foi possível copiar. Copie o endereço da barra do navegador.");
  }
}

export function MaterialActions({ materialId, title, shareUrl, loginHref, editHref, viewer, isAuthor, published, leading }: Props) {
  const router = useRouter();
  const [state, setState] = useState<ViewerState | null>(viewer);
  const [pending, startTransition] = useTransition();

  function toggle(kind: "favorite" | "saved") {
    if (!state) return;
    const previous = state;
    setState({ ...state, [kind]: !state[kind] });
    startTransition(async () => {
      const result = await toggleMaterialSave(materialId, kind);
      if (!result.ok) {
        setState(previous);
        toast.error(result.error);
        return;
      }
      setState((current) => (current ? { ...current, [kind]: result.active } : current));
      if (kind === "saved" && result.active) toast.success("Salvo na sua biblioteca.", { action: { label: "Ver salvos", onClick: () => router.push("/app/biblioteca/salvos") } });
    });
  }

  const share = (
    <Button variant="outline" size="sm" onClick={() => void shareLink(title, shareUrl)}>
      <Share2Icon className="size-4" /> Compartilhar
    </Button>
  );

  if (!published) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {leading}
        {editHref ? (
          <Button asChild size="sm">
            <Link href={editHref}>
              <PencilIcon className="size-4" /> Editar
            </Link>
          </Button>
        ) : null}
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {leading}
        <Button asChild variant="outline" size="sm">
          <Link href={loginHref}>
            <HeartIcon className="size-4" /> Favoritar
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={loginHref}>
            <BookmarkIcon className="size-4" /> Salvar
          </Link>
        </Button>
        {share}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {leading}
      <Button
        variant={state.favorite ? "secondary" : "outline"}
        size="sm"
        aria-pressed={state.favorite}
        disabled={pending}
        onClick={() => toggle("favorite")}
      >
        <HeartIcon className={cn("size-4", state.favorite && "fill-current")} /> {state.favorite ? "Favoritado" : "Favoritar"}
      </Button>
      <Button variant={state.saved ? "secondary" : "outline"} size="sm" aria-pressed={state.saved} disabled={pending} onClick={() => toggle("saved")}>
        <BookmarkIcon className={cn("size-4", state.saved && "fill-current")} /> {state.saved ? "Salvo" : "Salvar"}
      </Button>
      {share}
      {isAuthor && editHref ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={editHref}>
            <PencilIcon className="size-4" /> Editar
          </Link>
        </Button>
      ) : null}
      {!isAuthor ? (
        <ReportDialog
          materialId={materialId}
          materialUrl={shareUrl}
          alreadyReported={state.reported}
          onReported={() => setState((current) => (current ? { ...current, reported: true } : current))}
        />
      ) : null}
    </div>
  );
}

/** Avaliação de 1 a 5 com rádios nativos (setas do teclado funcionam). */
export function RatingInput({
  materialId,
  initial,
  loginHref,
  canRate,
  reason,
}: {
  materialId: string;
  initial: number | null;
  loginHref: string | null;
  canRate: boolean;
  reason?: string;
}) {
  const [value, setValue] = useState<number | null>(initial);
  const [hover, setHover] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  if (loginHref) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link href={loginHref} className="font-semibold text-primary hover:underline">
          Entre na sua conta
        </Link>{" "}
        para avaliar este material.
      </p>
    );
  }
  if (!canRate) return reason ? <p className="text-sm text-muted-foreground">{reason}</p> : null;

  function rate(next: number) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await rateMaterial(materialId, next);
      if (!result.ok) {
        setValue(previous);
        toast.error(result.error);
      } else if (previous === null) {
        toast.success("Obrigado pela avaliação!");
      }
    });
  }

  const shown = hover ?? value ?? 0;
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={pending}>
      <legend className="text-sm font-semibold">{value ? "Sua avaliação" : "Este material foi útil?"}</legend>
      <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer rounded-md p-0.5 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40" onMouseEnter={() => setHover(n)}>
            <input
              type="radio"
              name={`avaliacao-${materialId}`}
              value={n}
              checked={value === n}
              onChange={() => rate(n)}
              className="sr-only"
            />
            <StarIcon
              aria-hidden="true"
              className={cn("size-7 transition-colors", n <= shown ? "fill-[#f5b301] text-[#b7791f]" : "text-input")}
            />
            <span className="sr-only">
              {n} {n === 1 ? "estrela" : "estrelas"}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
