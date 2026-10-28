import { Skeleton } from "@/components/ui/feedback";

export function MaterialSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando material">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-9 w-80 max-w-full" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
