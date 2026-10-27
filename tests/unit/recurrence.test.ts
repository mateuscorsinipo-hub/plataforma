import { describe, expect, it } from "vitest";

import { expandOccurrences, findConflicts, type RecurringEvent } from "@/lib/domain/recurrence";

const tz = "America/Sao_Paulo";
const base: RecurringEvent = {
  id: "e1",
  // Terça, 3/11/2026, 19h em São Paulo (22h UTC).
  startsAt: "2026-11-03T22:00:00Z",
  endsAt: "2026-11-03T23:30:00Z",
  timezone: tz,
  allDay: false,
  recurrence: "weekly",
  recurrenceWeekdays: null,
  recurrenceUntil: null,
};
const range = (from: string, to: string) => [new Date(from), new Date(to)] as const;

describe("recorrência", () => {
  it("semanal repete no mesmo dia e horário local", () => {
    const [from, to] = range("2026-11-01T03:00:00Z", "2026-12-01T03:00:00Z");
    const occ = expandOccurrences(base, from, to);
    expect(occ.map((o) => o.localDate)).toEqual(["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
    expect(occ.every((o) => o.start.toISOString().endsWith("T22:00:00.000Z"))).toBe(true);
  });

  it("respeita dias escolhidos, quinzenal e data final", () => {
    const [from, to] = range("2026-11-01T03:00:00Z", "2026-12-01T03:00:00Z");
    const multi = expandOccurrences({ ...base, recurrenceWeekdays: [2, 4] }, from, to);
    expect(multi.map((o) => o.localDate).slice(0, 3)).toEqual(["2026-11-03", "2026-11-05", "2026-11-10"]);
    const biweekly = expandOccurrences({ ...base, recurrence: "biweekly" }, from, to);
    expect(biweekly.map((o) => o.localDate)).toEqual(["2026-11-03", "2026-11-17"]);
    const until = expandOccurrences({ ...base, recurrenceUntil: "2026-11-12" }, from, to);
    expect(until.map((o) => o.localDate)).toEqual(["2026-11-03", "2026-11-10"]);
  });

  it("mensal mantém o dia do mês e diário inclui todos os dias", () => {
    const monthly = expandOccurrences({ ...base, recurrence: "monthly" }, ...range("2026-11-01T03:00:00Z", "2027-02-01T03:00:00Z"));
    expect(monthly.map((o) => o.localDate)).toEqual(["2026-11-03", "2026-12-03", "2027-01-03"]);
    const daily = expandOccurrences({ ...base, recurrence: "daily" }, ...range("2026-11-03T03:00:00Z", "2026-11-06T03:00:00Z"));
    expect(daily).toHaveLength(3);
  });

  it("evento único só aparece se cruzar o intervalo", () => {
    const once = { ...base, recurrence: "none" as const };
    expect(expandOccurrences(once, ...range("2026-11-01T00:00:00Z", "2026-11-30T00:00:00Z"))).toHaveLength(1);
    expect(expandOccurrences(once, ...range("2026-12-01T00:00:00Z", "2026-12-30T00:00:00Z"))).toHaveLength(0);
  });
});

describe("conflitos", () => {
  const slots = [
    { eventId: "a", title: "Aula", start: new Date("2026-11-03T22:00:00Z"), end: new Date("2026-11-03T23:30:00Z"), allDay: false },
    { eventId: "b", title: "Prova", start: new Date("2026-11-03T03:00:00Z"), end: new Date("2026-11-04T02:59:00Z"), allDay: true },
  ];

  it("detecta sobreposição só entre eventos com horário", () => {
    const conflicts = findConflicts({ start: new Date("2026-11-03T23:00:00Z"), end: new Date("2026-11-04T00:00:00Z"), allDay: false }, slots);
    expect(conflicts.map((c) => c.eventId)).toEqual(["a"]);
    expect(findConflicts({ start: new Date("2026-11-03T23:30:00Z"), end: new Date("2026-11-04T00:00:00Z"), allDay: false }, slots)).toEqual([]);
    expect(findConflicts({ start: new Date("2026-11-03T23:00:00Z"), end: new Date("2026-11-04T00:00:00Z"), allDay: false, ignoreEventId: "a" }, slots)).toEqual([]);
  });
});
