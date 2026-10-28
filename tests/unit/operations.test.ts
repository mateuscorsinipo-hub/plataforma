import { afterEach, describe, expect, it, vi } from "vitest";

import { mapSubscriptionStatus, planForPrice } from "@/lib/billing/stripe";
import { dueReminders, reminderWhen, type ReminderEvent } from "@/lib/domain/reminders";

const now = new Date("2026-10-28T21:00:00Z"); // 18:00 em São Paulo

function event(overrides: Partial<ReminderEvent>): ReminderEvent {
  const starts = overrides.startsAt ?? new Date(now.getTime() + 20 * 60_000).toISOString();
  return {
    id: "ev",
    userId: "u",
    title: "Aula",
    startsAt: starts,
    endsAt: new Date(new Date(starts).getTime() + 3_600_000).toISOString(),
    timezone: "America/Sao_Paulo",
    allDay: false,
    recurrence: "none",
    recurrenceWeekdays: null,
    recurrenceUntil: null,
    reminderMinutes: 30,
    ...overrides,
  };
}

describe("lembretes do calendário", () => {
  it("avisa quando o horário do lembrete chegou e o evento ainda não começou", () => {
    expect(dueReminders([event({})], now)).toHaveLength(1);
  });

  it("não avisa cedo demais, nem depois que o evento começou", () => {
    expect(dueReminders([event({ startsAt: new Date(now.getTime() + 2 * 3_600_000).toISOString() })], now)).toHaveLength(0);
    expect(dueReminders([event({ startsAt: new Date(now.getTime() - 5 * 60_000).toISOString() })], now)).toHaveLength(0);
  });

  it("não reenvia lembrete muito atrasado (fora da tolerância)", () => {
    // Lembrete de 2 h antes de um evento que começa em 10 min: o aviso era há 1h50.
    expect(dueReminders([event({ startsAt: new Date(now.getTime() + 10 * 60_000).toISOString(), reminderMinutes: 120 })], now)).toHaveLength(0);
  });

  it("encontra a ocorrência de hoje de um evento semanal antigo", () => {
    const firstWeek = new Date("2026-09-02T21:15:00Z"); // quarta, 18:15 em São Paulo
    const weekly = event({ startsAt: firstWeek.toISOString(), recurrence: "weekly", reminderMinutes: 30 });
    const due = dueReminders([weekly], now);
    expect(due).toHaveLength(1);
    expect(due[0]!.occurrenceStart.toISOString()).toBe("2026-10-28T21:15:00.000Z");
  });

  it("descreve quando começa", () => {
    expect(reminderWhen(new Date(now.getTime() + 20 * 60_000), "America/Sao_Paulo", now)).toBe("Começa em 20 min (às 18:20).");
    expect(reminderWhen(new Date("2026-10-30T13:00:00Z"), "America/Sao_Paulo", now)).toBe("Começa sexta-feira, 30 de out., às 10:00.");
  });
});

describe("assinaturas", () => {
  it("mapeia status do Stripe e trata desconhecidos como incompletos", () => {
    expect(mapSubscriptionStatus("active")).toBe("active");
    expect(mapSubscriptionStatus("past_due")).toBe("past_due");
    expect(mapSubscriptionStatus("algo_novo")).toBe("incomplete");
  });

  it("preço desconhecido nunca vira Pro", () => {
    expect(planForPrice("price_qualquer")).toBeNull();
    expect(planForPrice(null)).toBeNull();
  });
});

describe("rotinas agendadas", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadRoute(secret: string) {
    vi.stubEnv("CRON_SECRET", secret);
    vi.resetModules();
    return import("@/app/api/cron/[job]/route");
  }

  const ctx = (job: string) => ({ params: Promise.resolve({ job }) }) as never;

  it("ficam desligadas sem segredo configurado", async () => {
    const { GET } = await loadRoute("");
    const response = await GET(new Request("http://localhost/api/cron/limpeza"), ctx("limpeza"));
    expect(response.status).toBe(503);
  });

  it("recusam pedido sem o segredo certo e rotina desconhecida", async () => {
    const { GET } = await loadRoute("segredo-de-teste-com-32-caracteres!");
    const wrong = await GET(new Request("http://localhost/api/cron/limpeza", { headers: { authorization: "Bearer outro" } }), ctx("limpeza"));
    expect(wrong.status).toBe(401);
    const unknown = await GET(
      new Request("http://localhost/api/cron/x", { headers: { authorization: "Bearer segredo-de-teste-com-32-caracteres!" } }),
      ctx("x"),
    );
    expect(unknown.status).toBe(404);
  });
});
