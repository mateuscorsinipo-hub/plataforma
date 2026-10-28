"use client";

import { useEffect } from "react";

/**
 * Conta a visualização depois que a página abre no navegador (robôs de pré-visualização
 * e prefetch não contam). O servidor deduplica por pessoa e por dia e ignora o autor.
 */
export function ViewTracker({ materialId }: { materialId: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch(`/api/materials/${materialId}/view`, { method: "POST", keepalive: true }).catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [materialId]);
  return null;
}
