import { describe, expect, it } from "vitest";

import { examCountdown } from "@/app/app/pastas/_components/labels";
import { safeAvatarUrl } from "@/lib/avatar";
import { defaultSortFor, filterFormValues, filtersToSearch, parseLibraryFilters } from "@/lib/data/library";
import { publicEnv } from "@/lib/env/public";
import { folderSchema, makeSlug, materialSchema, parseTags, publishBlockers, slugBase } from "@/lib/validation/materials";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("endereço dos materiais", () => {
  it("tira acentos e símbolos do título", () => {
    expect(slugBase("Função Afim: gráficos & exercícios!")).toBe("funcao-afim-graficos-exercicios");
  });

  it("usa um nome padrão quando o título não tem letras", () => {
    expect(slugBase("?!?!?")).toBe("material");
  });

  it("limita o tamanho sem deixar hífen no fim", () => {
    const base = slugBase(`${"palavra ".repeat(30)}fim`);
    expect(base.length).toBeLessThanOrEqual(80);
    expect(base.endsWith("-")).toBe(false);
  });

  it("acrescenta um sufixo aleatório e respeita o formato aceito pelo banco", () => {
    const slug = makeSlug("Resumo de Química Orgânica");
    expect(slug).toMatch(/^resumo-de-quimica-organica-[a-z0-9]{6}$/);
    expect(slug).toMatch(SLUG);
    expect(makeSlug("Título", () => 0)).toBe("titulo-aaaaaa");
  });
});

describe("etiquetas", () => {
  it("normaliza, remove # e repetições", () => {
    expect(parseTags("ENEM, #Gráficos, enem,  função   afim ")).toEqual(["enem", "gráficos", "função afim"]);
  });

  it("aceita no máximo 10 etiquetas de até 30 caracteres", () => {
    const tags = parseTags(Array.from({ length: 15 }, (_, i) => `tag${i}`).join(","));
    expect(tags).toHaveLength(10);
    expect(parseTags("a".repeat(50))[0]).toHaveLength(30);
  });
});

describe("validação do material", () => {
  const base = {
    title: "Resumo de Biologia Celular",
    subjectId: "8f0b7c1e-2f43-4a5b-9a51-3c1d2e4f5a6b",
    materialType: "summary" as const,
  };

  it("descarta série que não existe na etapa escolhida", () => {
    const parsed = materialSchema.parse({ ...base, schoolStage: "medio", gradeYear: "7" });
    expect(parsed.gradeYear).toBeNull();
    expect(materialSchema.parse({ ...base, schoolStage: "medio", gradeYear: "2" }).gradeYear).toBe(2);
  });

  it("transforma tema vazio em nulo e etiquetas em lista", () => {
    const parsed = materialSchema.parse({ ...base, topic: "  ", tags: "citologia, Mitose" });
    expect(parsed.topic).toBeNull();
    expect(parsed.tags).toEqual(["citologia", "mitose"]);
  });

  it("recusa título curto e matéria ausente", () => {
    const result = materialSchema.safeParse({ ...base, title: "Oi", subjectId: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("title");
      expect(paths).toContain("subjectId");
    }
  });

  it("lista o que falta para publicar (mesmas regras do banco)", () => {
    expect(publishBlockers({ visibility: "private", copyright: false, content: "curto", fileId: null })).toHaveLength(3);
    expect(publishBlockers({ visibility: "public", copyright: true, content: "x".repeat(200), fileId: null })).toEqual([]);
    expect(publishBlockers({ visibility: "unlisted", copyright: true, content: "", fileId: base.subjectId })).toEqual([]);
  });

  it("valida pastas", () => {
    expect(folderSchema.safeParse({ name: " " }).success).toBe(false);
    const parsed = folderSchema.parse({ name: "Prova", color: "green", subjectId: "nao-e-uuid", examDate: "2026-13-99x" });
    expect(parsed.subjectId).toBeNull();
    expect(parsed.examDate).toBeNull();
    expect(folderSchema.safeParse({ name: "Prova", color: "neon" }).success).toBe(false);
  });
});

describe("filtros da biblioteca na URL", () => {
  it("ignora valores desconhecidos e limita a página", () => {
    const filters = parseLibraryFilters({ etapa: "faculdade", tipo: "video", serie: "12", pagina: "9999", materia: "Mat;drop" });
    expect(filters).toMatchObject({ stage: null, type: null, grade: null, page: 1, subjectSlug: null });
  });

  it("ordena por relevância só quando há busca", () => {
    expect(parseLibraryFilters({}).sort).toBe("recentes");
    expect(parseLibraryFilters({ q: "mitose" }).sort).toBe("relevancia");
    expect(defaultSortFor({ q: "" })).toBe("recentes");
  });

  it("gera URLs limpas e reversíveis", () => {
    const filters = parseLibraryFilters({ q: "função afim", materia: "matematica", etapa: "medio", serie: "1", ordem: "salvos", pagina: "2" });
    const search = filtersToSearch(filters);
    expect(search).toBe("?q=fun%C3%A7%C3%A3o+afim&materia=matematica&etapa=medio&serie=1&ordem=salvos&pagina=2");
    expect(parseLibraryFilters(Object.fromEntries(new URLSearchParams(search)))).toEqual(filters);
    expect(filtersToSearch(parseLibraryFilters({}))).toBe("");
  });

  it("devolve os valores do formulário como texto", () => {
    expect(filterFormValues(parseLibraryFilters({ serie: "3", etapa: "medio" }))).toMatchObject({ serie: "3", etapa: "medio", materia: "" });
  });
});

describe("foto de perfil segura", () => {
  it("só aceita o bucket de avatares do próprio Supabase", () => {
    const own = `${publicEnv.supabaseUrl}/storage/v1/object/public/avatars/123/avatar?v=1`;
    expect(safeAvatarUrl(own)).toBe(publicEnv.supabaseUrl ? own : null);
    expect(safeAvatarUrl("https://rastreador.example.com/pixel.png")).toBeNull();
    expect(safeAvatarUrl(`${publicEnv.supabaseUrl}/storage/v1/object/public/uploads/x`)).toBeNull();
    expect(safeAvatarUrl(null)).toBeNull();
  });
});

describe("contagem regressiva da prova", () => {
  it("conta em dias de calendário", () => {
    expect(examCountdown("2026-11-02", "2026-10-28")).toEqual({ text: "Prova em 5 dias", urgent: true });
    expect(examCountdown("2026-12-20", "2026-10-28")).toEqual({ text: "Prova em 53 dias", urgent: false });
    expect(examCountdown("2026-10-29", "2026-10-28")?.text).toBe("Prova amanhã");
    expect(examCountdown("2026-10-28", "2026-10-28")?.text).toBe("Prova hoje");
    expect(examCountdown("2026-10-20", "2026-10-28")?.urgent).toBe(false);
    expect(examCountdown(null, "2026-10-28")).toBeNull();
  });
});
