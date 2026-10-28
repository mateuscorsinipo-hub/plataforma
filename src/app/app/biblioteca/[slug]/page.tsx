import type { Metadata } from "next";
import { Suspense } from "react";

import { MaterialDetail } from "@/components/library/material-detail";
import { MaterialSkeleton } from "@/components/library/material-skeleton";
import { requireStudent } from "@/lib/auth/session";
import { getVisibleMaterial } from "@/lib/data/library";

export async function generateMetadata({ params }: PageProps<"/app/biblioteca/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const material = await getVisibleMaterial(slug);
  return { title: material?.title ?? "Material não encontrado", alternates: material ? { canonical: `/biblioteca/${material.slug}` } : undefined };
}

export default function AppMaterialPage({ params }: PageProps<"/app/biblioteca/[slug]">) {
  return (
    <Suspense fallback={<MaterialSkeleton />}>
      <Material params={params} />
    </Suspense>
  );
}

async function Material({ params }: { params: PageProps<"/app/biblioteca/[slug]">["params"] }) {
  const { slug } = await params;
  await requireStudent(`/app/biblioteca/${slug}`);
  return <MaterialDetail slug={slug} context="app" />;
}
