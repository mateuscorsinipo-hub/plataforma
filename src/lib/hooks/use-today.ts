"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function todayInBrowser(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}

/**
 * Data de hoje (AAAA-MM-DD) no relógio do navegador. No servidor e durante a
 * hidratação é `undefined`, o que evita divergência com o HTML gerado.
 */
export function useToday(): string | undefined {
  return useSyncExternalStore(subscribe, todayInBrowser, () => undefined);
}

/** Fuso horário do navegador (padrão America/Sao_Paulo antes da hidratação). */
export function useBrowserTimezone(): string {
  return useSyncExternalStore(subscribe, browserTimezone, () => "America/Sao_Paulo");
}
