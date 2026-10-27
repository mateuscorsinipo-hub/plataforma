"use client";

import { RotateCcwIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { startAttempt } from "../actions";

export function RetryButton({ quizId }: { quizId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startAttempt(quizId);
          if (result && !result.ok) toast.error(result.error);
        })
      }
    >
      <RotateCcwIcon /> Refazer
    </Button>
  );
}
