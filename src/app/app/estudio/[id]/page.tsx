import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/billing/entitlements";
import { getGeneration } from "@/lib/data/studio";
import { formatDateBR, localDateString } from "@/lib/domain/dates";
import { uuidSchema } from "@/lib/validation/common";

import { GenerationView } from "../_components/generation-view";

export const metadata: Metadata = { title: "Material do estúdio" };

export default function GenerationPage({ params }: PageProps<"/app/estudio/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando material">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-9 w-96 max-w-full" />
          <Skeleton className="h-[28rem]" />
        </div>
      }
    >
      <Generation params={params} />
    </Suspense>
  );
}

async function Generation({ params }: { params: PageProps<"/app/estudio/[id]">["params"] }) {
  const { id } = await params;
  const { user } = await requireStudent(`/app/estudio/${id}`);
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) notFound();
  const [generation, timezone] = await Promise.all([getGeneration(parsed.data), getUserTimezone(user.id)]);
  if (!generation) notFound();
  const createdLabel = formatDateBR(localDateString(timezone, new Date(generation.createdAt)), { day: "2-digit", month: "long", year: "numeric" });
  return <GenerationView key={generation.id} generation={generation} createdLabel={createdLabel} />;
}
