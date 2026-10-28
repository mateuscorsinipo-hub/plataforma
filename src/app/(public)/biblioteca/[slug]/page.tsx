import type { Metadata } from "next";
import { Suspense } from "react";

import { MaterialDetail } from "@/components/library/material-detail";
import { MaterialSkeleton } from "@/components/library/material-skeleton";
import { materialTypeLabels } from "@/lib/config/subjects";
import { getVisibleMaterial } from "@/lib/data/library";

export async function generateMetadata({ params }: PageProps<"/biblioteca/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const material = await getVisibleMaterial(slug);
  if (!material) return { title: "Material não encontrado", robots: { index: false } };
  const indexable = material.status === "published" && material.visibility === "public";
  const description = (material.description || material.content.replace(/[#*_>`$\\[\]()-]/g, " ").replace(/\s+/g, " ")).trim().slice(0, 160);
  return {
    title: `${material.title} · ${materialTypeLabels[material.material_type]}`,
    description: description || undefined,
    alternates: { canonical: `/biblioteca/${material.slug}` },
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: { type: "article", title: material.title, description: description || undefined, url: `/biblioteca/${material.slug}` },
  };
}

export default function MaterialPage({ params }: PageProps<"/biblioteca/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<MaterialSkeleton />}>
        <Material params={params} />
      </Suspense>
    </div>
  );
}

async function Material({ params }: { params: PageProps<"/biblioteca/[slug]">["params"] }) {
  const { slug } = await params;
  return <MaterialDetail slug={slug} context="public" />;
}
