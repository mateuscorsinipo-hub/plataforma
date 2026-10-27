import { describe, expect, it } from "vitest";

import {
  addDays,
  dateRange,
  daysBetween,
  greetingFor,
  isValidDateString,
  localDateString,
  timezoneOffsetMinutes,
  weekStart,
  weekday,
  zonedTimeToUtc,
} from "@/lib/domain/dates";

describe("datas de calendário", () => {
  it("calcula a data local no fuso do estudante, não do servidor", () => {
    // 02:30 UTC do dia 28 ainda é dia 27 em São Paulo (UTC−3).
    const instant = new Date("2026-10-28T02:30:00Z");
    expect(localDateString("America/Sao_Paulo", instant)).toBe("2026-10-27");
    expect(localDateString("UTC", instant)).toBe("2026-10-28");
    expect(localDateString("Asia/Tokyo", instant)).toBe("2026-10-28");
  });

  it("usa o fuso padrão quando o fuso é inválido", () => {
    const instant = new Date("2026-10-28T02:30:00Z");
    expect(localDateString("Nao/Existe", instant)).toBe("2026-10-27");
  });

  it("soma dias atravessando meses e anos", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("conta dias entre datas", () => {
    expect(daysBetween("2026-10-27", "2026-11-08")).toBe(12);
    expect(daysBetween("2026-11-08", "2026-10-27")).toBe(-12);
  });

  it("encontra a segunda-feira da semana", () => {
    expect(weekStart("2026-10-27")).toBe("2026-10-26"); // terça → segunda
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // domingo → segunda anterior
    expect(weekday("2026-10-26")).toBe(1);
  });

  it("gera intervalos inclusivos", () => {
    expect(dateRange("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });

  it("valida datas reais", () => {
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(isValidDateString("2028-02-29")).toBe(true);
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("27/10/2026")).toBe(false);
  });

  it("converte horário local em UTC respeitando o fuso", () => {
    expect(zonedTimeToUtc("2026-10-27", "08:00", "America/Sao_Paulo").toISOString()).toBe("2026-10-27T11:00:00.000Z");
    expect(zonedTimeToUtc("2026-07-01", "09:30", "Europe/Lisbon").toISOString()).toBe("2026-07-01T08:30:00.000Z");
    expect(timezoneOffsetMinutes("America/Sao_Paulo", new Date("2026-10-27T12:00:00Z"))).toBe(-180);
  });

  it("escolhe a saudação pela hora local", () => {
    expect(greetingFor(8)).toBe("Bom dia");
    expect(greetingFor(14)).toBe("Boa tarde");
    expect(greetingFor(21)).toBe("Boa noite");
    expect(greetingFor(2)).toBe("Boa noite");
  });
});
