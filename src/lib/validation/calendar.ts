import { z } from "zod";

import { isValidDateString } from "@/lib/domain/dates";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");

export const eventTypes = ["exam", "class", "study", "task", "reminder", "other"] as const;
export const eventTypeLabels: Record<(typeof eventTypes)[number], string> = {
  exam: "Prova",
  class: "Aula",
  study: "Estudo",
  task: "Tarefa",
  reminder: "Lembrete",
  other: "Outro",
};
export const recurrenceLabels = { none: "Não repete", daily: "Todo dia", weekly: "Toda semana", biweekly: "A cada 2 semanas", monthly: "Todo mês" } as const;
export const reminderOptions = [
  { value: "", label: "Sem lembrete" },
  { value: "0", label: "Na hora" },
  { value: "10", label: "10 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
  { value: "1440", label: "1 dia antes" },
] as const;

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Dê um título.").max(120, "Use no máximo 120 caracteres."),
    description: z.string().trim().max(1000).optional().default(""),
    eventType: z.enum(eventTypes),
    subjectId: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((v) => v || null),
    date: z.string().refine(isValidDateString, "Data inválida."),
    allDay: z.boolean(),
    startTime: time.optional().default("08:00"),
    endTime: time.optional().default("09:00"),
    recurrence: z.enum(["none", "daily", "weekly", "biweekly", "monthly"]),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional().default([]),
    until: z
      .string()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || isValidDateString(v), "Data final inválida."),
    reminderMinutes: z
      .union([z.literal(""), z.coerce.number().int().min(0).max(10080)])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    location: z.string().trim().max(200).optional().default(""),
  })
  .refine((e) => e.allDay || e.endTime > e.startTime, { message: "O fim precisa ser depois do início.", path: ["endTime"] })
  .refine((e) => !e.until || e.until >= e.date, { message: "A data final precisa ser depois do início.", path: ["until"] });

export type EventInput = z.input<typeof eventSchema>;
