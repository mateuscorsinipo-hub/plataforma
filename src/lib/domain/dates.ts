/**
 * Datas "de calendário" no fuso do estudante, representadas como "AAAA-MM-DD".
 * Funções puras, sem dependência do fuso do servidor.
 */
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function safeTimezone(tz: string | null | undefined): string {
  return tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

/** Data local (AAAA-MM-DD) de um instante num fuso. */
export function localDateString(timezone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function toUtcDate(date: string): Date {
  const [y, m, d] = date.split("-").map((v) => Number.parseInt(v, 10));
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function fromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = toUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcDate(d);
}

/** Diferença em dias de calendário (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcDate(b).getTime() - toUtcDate(a).getTime()) / 86_400_000);
}

/** Dia da semana: 0 = domingo ... 6 = sábado. */
export function weekday(date: string): number {
  return toUtcDate(date).getUTCDay();
}

/** Segunda-feira da semana da data (semana ISO). */
export function weekStart(date: string): string {
  const day = weekday(date);
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const total = daysBetween(from, to);
  for (let i = 0; i <= total; i += 1) out.push(addDays(from, i));
  return out;
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtcDate(toUtcDate(value)) === value;
}

const weekdayShort = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const weekdayLong = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

export function weekdayLabel(day: number, style: "short" | "long" = "short"): string {
  return (style === "short" ? weekdayShort : weekdayLong)[((day % 7) + 7) % 7] ?? "";
}

export function formatDateBR(date: string, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...options }).format(toUtcDate(date));
}

/** Hora do dia (0–23) num fuso, para saudação. */
export function localHour(timezone: string, at: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone: safeTimezone(timezone), hour: "numeric", hourCycle: "h23" }).format(at);
  return Number.parseInt(hour, 10) % 24;
}

export function greetingFor(hour: number): string {
  if (hour < 5) return "Boa noite";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Converte uma data e hora locais (no fuso informado) em instante UTC.
 * Resolve o deslocamento do fuso naquele momento (horário de verão incluído).
 */
export function zonedTimeToUtc(date: string, time: string, timezone: string): Date {
  const [h, min] = time.split(":").map((v) => Number.parseInt(v, 10));
  const base = toUtcDate(date);
  const guess = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h ?? 0, min ?? 0));
  const offset = timezoneOffsetMinutes(timezone, guess);
  const adjusted = new Date(guess.getTime() - offset * 60_000);
  const offsetAfter = timezoneOffsetMinutes(timezone, adjusted);
  return offsetAfter === offset ? adjusted : new Date(guess.getTime() - offsetAfter * 60_000);
}

/** Deslocamento do fuso em minutos (local − UTC) num instante. */
export function timezoneOffsetMinutes(timezone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimezone(timezone),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Hora local "HH:MM" de um instante num fuso. */
export function localTimeString(timezone: string, at: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: safeTimezone(timezone),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}
