/** Fusos oferecidos nas preferências (lista estável para servidor e navegador). */
export const timezoneOptions: { value: string; label: string }[] = [
  { value: "America/Sao_Paulo", label: "Brasília (SP, RJ, MG, Sul, GO, DF...)" },
  { value: "America/Bahia", label: "Bahia" },
  { value: "America/Fortaleza", label: "Fortaleza (CE, MA, PI, RN, PB)" },
  { value: "America/Recife", label: "Recife (PE)" },
  { value: "America/Maceio", label: "Maceió (AL, SE)" },
  { value: "America/Belem", label: "Belém (PA leste, AP)" },
  { value: "America/Santarem", label: "Santarém (PA oeste)" },
  { value: "America/Araguaina", label: "Araguaína (TO)" },
  { value: "America/Cuiaba", label: "Cuiabá (MT)" },
  { value: "America/Campo_Grande", label: "Campo Grande (MS)" },
  { value: "America/Manaus", label: "Manaus (AM)" },
  { value: "America/Porto_Velho", label: "Porto Velho (RO)" },
  { value: "America/Boa_Vista", label: "Boa Vista (RR)" },
  { value: "America/Rio_Branco", label: "Rio Branco (AC)" },
  { value: "America/Noronha", label: "Fernando de Noronha" },
  { value: "Europe/Lisbon", label: "Lisboa" },
  { value: "America/New_York", label: "Nova York" },
  { value: "UTC", label: "UTC" },
];

export function timezoneLabel(value: string): string {
  return timezoneOptions.find((tz) => tz.value === value)?.label ?? value;
}
