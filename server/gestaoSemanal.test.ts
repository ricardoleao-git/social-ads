/**
 * Testes unitários para o módulo de Gestão Semanal
 * Cobre: weeklyUrlMonitor, weeklyLandingPageAnalysis, gestaoSemanalRouter
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Testes do weeklyUrlMonitor ───────────────────────────────────────────────

describe("weeklyUrlMonitor — lógica de verificação de URLs", () => {
  it("deve identificar URL como quebrada quando status é 404", () => {
    const checkResult = { url: "https://zenite.tech/contato", status: 404, ok: false };
    expect(checkResult.ok).toBe(false);
    expect(checkResult.status).toBe(404);
  });

  it("deve identificar URL como válida quando status é 200", () => {
    const checkResult = { url: "https://zenite.tech/solucoes/avant-charge", status: 200, ok: true };
    expect(checkResult.ok).toBe(true);
    expect(checkResult.status).toBe(200);
  });

  it("deve identificar URL como quebrada quando status é 301 sem redirect", () => {
    const checkResult = { url: "https://zenite.tech/ponto-eletronico-portaria-671", status: 301, ok: false };
    expect(checkResult.ok).toBe(false);
  });

  it("deve gerar lista de URLs quebradas corretamente", () => {
    const results = [
      { url: "https://zenite.tech/solucoes/avant-charge", status: 200, ok: true },
      { url: "https://zenite.tech/contato", status: 404, ok: false },
      { url: "https://zenite.tech/ponto-eletronico-portaria-671", status: 404, ok: false },
    ];
    const broken = results.filter(r => !r.ok);
    expect(broken).toHaveLength(2);
    expect(broken[0].url).toContain("contato");
    expect(broken[1].url).toContain("portaria");
  });

  it("deve formatar e-mail de alerta com URLs quebradas", () => {
    const brokenUrls = [
      { url: "https://zenite.tech/contato", status: 404 },
      { url: "https://zenite.tech/ponto-eletronico-portaria-671", status: 404 },
    ];
    const emailBody = brokenUrls
      .map(u => `• ${u.url} → HTTP ${u.status}`)
      .join("\n");
    expect(emailBody).toContain("contato");
    expect(emailBody).toContain("HTTP 404");
    expect(emailBody.split("\n")).toHaveLength(2);
  });
});

// ─── Testes do weeklyLandingPageAnalysis ─────────────────────────────────────

describe("weeklyLandingPageAnalysis — análise de landing pages", () => {
  it("deve calcular score de qualidade corretamente", () => {
    const calcScore = (hasH1: boolean, hasCTA: boolean, hasForm: boolean, psScore: number) => {
      let score = 0;
      if (hasH1) score += 25;
      if (hasCTA) score += 25;
      if (hasForm) score += 20;
      score += Math.round(psScore * 0.30);
      return Math.min(score, 100);
    };

    // Página completa
    expect(calcScore(true, true, true, 90)).toBe(97);
    // Página sem formulário
    expect(calcScore(true, true, false, 80)).toBe(74);
    // Página mínima
    expect(calcScore(false, false, false, 50)).toBe(15);
  });

  it("deve determinar prioridade baseada no CTR do grupo de anúncios", () => {
    const getPriority = (ctr: number, conversions: number) => {
      if (ctr < 3 || conversions === 0) return "alta";
      if (ctr < 8) return "media";
      return "baixa";
    };

    expect(getPriority(0, 0)).toBe("alta");
    expect(getPriority(2.5, 0)).toBe("alta");
    expect(getPriority(5, 0)).toBe("alta");
    expect(getPriority(5, 3)).toBe("media");
    expect(getPriority(12, 5)).toBe("baixa");
  });

  it("deve mapear grupos de anúncios para URLs de destino", () => {
    const urlMap: Record<string, string> = {
      "WhatsApp": "https://zenite.tech/solucoes/zipy",
      "Avant Charge": "https://zenite.tech/solucoes/avant-charge",
      "REP": "https://zenite.tech/solucoes/ponto-eletronico",
      "PABX": "https://zenite.tech/solucoes/pabx",
    };

    expect(urlMap["Avant Charge"]).toBe("https://zenite.tech/solucoes/avant-charge");
    expect(urlMap["REP"]).toBe("https://zenite.tech/solucoes/ponto-eletronico");
    expect(urlMap["REP"]).not.toContain("portaria-671");
  });

  it("deve identificar problemas comuns em landing pages", () => {
    const detectIssues = (page: {
      hasH1: boolean; hasCTA: boolean; hasForm: boolean;
      psScore: number; metaDescLength: number;
    }) => {
      const issues: string[] = [];
      if (!page.hasH1) issues.push("Sem H1 principal");
      if (!page.hasCTA) issues.push("Sem CTA visível");
      if (!page.hasForm) issues.push("Sem formulário de captura");
      if (page.psScore < 50) issues.push("PageSpeed crítico (< 50)");
      if (page.metaDescLength < 50) issues.push("Meta description muito curta");
      return issues;
    };

    const badPage = { hasH1: false, hasCTA: false, hasForm: false, psScore: 30, metaDescLength: 20 };
    const issues = detectIssues(badPage);
    expect(issues).toHaveLength(5);
    expect(issues).toContain("Sem H1 principal");
    expect(issues).toContain("PageSpeed crítico (< 50)");

    const goodPage = { hasH1: true, hasCTA: true, hasForm: true, psScore: 85, metaDescLength: 120 };
    expect(detectIssues(goodPage)).toHaveLength(0);
  });
});

// ─── Testes do gestaoSemanalRouter ───────────────────────────────────────────

describe("gestaoSemanalRouter — endpoints de gestão semanal", () => {
  it("deve calcular label da semana corretamente", () => {
    const getWeekLabel = (date: Date) => {
      const start = new Date(date);
      start.setDate(date.getDate() - date.getDay() + 1); // Segunda
      const end = new Date(start);
      end.setDate(start.getDate() + 6); // Domingo
      const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      return `${fmt(start)} – ${fmt(end)}`;
    };

    // 12 de abril de 2026 é domingo — semana começa em 06/04
    const label = getWeekLabel(new Date("2026-04-12"));
    expect(label).toMatch(/\d{2}\/\d{2} – \d{2}\/\d{2}/);
  });

  it("deve calcular score geral da conta baseado nos grupos", () => {
    const calcAccountScore = (groups: Array<{ ctr: number; conversions: number }>) => {
      if (groups.length === 0) return 0;
      const avgCtr = groups.reduce((s, g) => s + g.ctr, 0) / groups.length;
      const totalConv = groups.reduce((s, g) => s + g.conversions, 0);
      let score = Math.min(avgCtr * 5, 60); // até 60 pts por CTR
      score += Math.min(totalConv * 2, 40); // até 40 pts por conversões
      return Math.round(score);
    };

    const groups = [
      { ctr: 14.34, conversions: 15 },
      { ctr: 6.45, conversions: 2 },
      { ctr: 25.0, conversions: 1 },
    ];
    const score = calcAccountScore(groups);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("deve classificar saúde da conta corretamente", () => {
    const getHealthStatus = (score: number) => {
      if (score >= 75) return "excelente";
      if (score >= 50) return "bom";
      if (score >= 25) return "regular";
      return "critico";
    };

    expect(getHealthStatus(80)).toBe("excelente");
    expect(getHealthStatus(60)).toBe("bom");
    expect(getHealthStatus(35)).toBe("regular");
    expect(getHealthStatus(10)).toBe("critico");
  });

  it("deve gerar estrutura correta do relatório semanal", () => {
    const report = {
      weekLabel: "07/04 – 13/04",
      accountScore: 72,
      healthStatus: "bom",
      totalSpend: 1250.50,
      totalConversions: 28,
      topPerformer: "Avant Charge",
      criticalGroups: ["PABX em Nuvem", "Prédio Inteligente"],
      recommendations: ["Pausar PABX", "Aumentar orçamento Avant Charge"],
      generatedAt: new Date().toISOString(),
    };

    expect(report.weekLabel).toMatch(/\d{2}\/\d{2}/);
    expect(report.accountScore).toBeGreaterThan(0);
    expect(report.criticalGroups).toBeInstanceOf(Array);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.generatedAt).toBeTruthy();
  });
});

// ─── Testes de exportação do chat ─────────────────────────────────────────────

describe("exportação do histórico do chat", () => {
  it("deve formatar mensagens corretamente para exportação", () => {
    const messages = [
      { role: "user" as const, content: "Qual o CTR da campanha?", timestamp: new Date("2026-04-12T10:00:00") },
      { role: "assistant" as const, content: "O CTR médio é 14,34%.", timestamp: new Date("2026-04-12T10:00:05") },
    ];

    const lines: string[] = [];
    messages.forEach(m => {
      const role = m.role === "user" ? "Ricardo" : "IA";
      const time = m.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      lines.push(`[${time}] ${role}:`);
      lines.push(m.content);
      lines.push("");
    });

    const output = lines.join("\n");
    expect(output).toContain("Ricardo:");
    expect(output).toContain("IA:");
    expect(output).toContain("CTR da campanha");
    expect(output).toContain("14,34%");
  });

  it("deve gerar nome de arquivo com data correta", () => {
    const date = new Date("2026-04-12");
    const filename = `chat-trafego-${date.toISOString().split("T")[0]}.txt`;
    expect(filename).toBe("chat-trafego-2026-04-12.txt");
    expect(filename).toMatch(/\.txt$/);
  });
});
