import type { Metadata } from "next";
import { Suspense } from "react";

import { UrlToast } from "@/components/app-shell/url-toast";
import { Skeleton } from "@/components/ui/feedback";

import { QuizList } from "./_components/quiz-list";

export const metadata: Metadata = { title: "Quizzes" };

export default function QuizzesPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense>
        <UrlToast />
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <QuizList kind="quiz" />
      </Suspense>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
