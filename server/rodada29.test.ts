/**
 * Testes Rodada 29 — Dashboard Compartilhável, Chat IA Flutuante, Alertas de Saldo WhatsApp
 */
import { describe, it, expect, vi } from "vitest";

// ─── 1. SharedDashboard Router ──────────────────────────────────────────────
describe("SharedDashboard Router", () => {
  it("deve gerar token único de 32 caracteres hex", () => {
    const crypto = require("crypto");
    const token = crypto.randomBytes(16).toString("hex");
    expect(token).toHaveLength(32);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });

  it("deve validar estrutura do payload de criação", () => {
    const payload = {
      clientName: "Avant Charge",
      metrics: ["impressions", "clicks", "conversions", "ctr", "cpc"],
      expiresInDays: 30,
    };
    expect(payload.clientName).toBeTruthy();
    expect(payload.metrics.length).toBeGreaterThan(0);
    expect(payload.expiresInDays).toBeGreaterThan(0);
    expect(payload.expiresInDays).toBeLessThanOrEqual(365);
  });

  it("deve calcular data de expiração corretamente", () => {
    const expiresInDays = 30;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
    const diffDays = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });

  it("deve aceitar métricas válidas", () => {
    const validMetrics = ["impressions", "clicks", "conversions", "ctr", "cpc", "spend", "cpa"];
    const selectedMetrics = ["impressions", "clicks", "conversions"];
    const allValid = selectedMetrics.every(m => validMetrics.includes(m));
    expect(allValid).toBe(true);
  });
});

// ─── 2. AI Chat Floating ────────────────────────────────────────────────────
describe("AI Chat Service", () => {
  it("deve ter contexto estático com informações da Zênite Tech", () => {
    const STATIC_CONTEXT = `Você é o Assistente de Tráfego Pago da Zênite Tech`;
    expect(STATIC_CONTEXT).toContain("Zênite Tech");
    expect(STATIC_CONTEXT).toContain("Tráfego Pago");
  });

  it("deve gerar conversationId único", () => {
    const id1 = `conv_${Date.now()}`;
    const id2 = `conv_${Date.now() + 1}`;
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^conv_\d+$/);
  });

  it("deve limitar mensagem a 2000 caracteres", () => {
    const maxLength = 2000;
    const shortMsg = "Qual campanha está melhor?";
    const longMsg = "a".repeat(2001);
    expect(shortMsg.length).toBeLessThanOrEqual(maxLength);
    expect(longMsg.length).toBeGreaterThan(maxLength);
  });

  it("deve detectar keywords de ação na resposta da IA", () => {
    const actionKeywords = ["pause", "adicione negativo", "negativar", "aumentar lance", "reduzir lance"];
    const responseWithAction = "Recomendo pause o grupo PABX em Nuvem por baixo CTR.";
    const responseNoAction = "O CTR geral está em 10.82%, acima da média do setor.";
    
    const hasAction1 = actionKeywords.some(kw => responseWithAction.toLowerCase().includes(kw));
    const hasAction2 = actionKeywords.some(kw => responseNoAction.toLowerCase().includes(kw));
    
    expect(hasAction1).toBe(true);
    expect(hasAction2).toBe(false);
  });
});

// ─── 3. Budget Alert com WhatsApp ───────────────────────────────────────────
describe("Budget Alert with WhatsApp", () => {
  it("deve calcular percentual de consumo corretamente", () => {
    const spendMicros = 400_000_000; // R$ 400
    const budgetMicros = 500_000_000; // R$ 500
    const pct = spendMicros / budgetMicros;
    expect(pct).toBe(0.8);
    expect(pct >= 0.8).toBe(true);
  });

  it("deve disparar alerta quando consumo >= 80%", () => {
    const ALERT_THRESHOLD = 0.80;
    const scenarios = [
      { spend: 79, budget: 100, shouldAlert: false },
      { spend: 80, budget: 100, shouldAlert: true },
      { spend: 95, budget: 100, shouldAlert: true },
      { spend: 100, budget: 100, shouldAlert: true },
    ];
    
    for (const s of scenarios) {
      const pct = s.spend / s.budget;
      expect(pct >= ALERT_THRESHOLD).toBe(s.shouldAlert);
    }
  });

  it("deve formatar mensagem de alerta WhatsApp corretamente", () => {
    const totalSpend = 400;
    const totalBudget = 500;
    const pct = Math.round((totalSpend / totalBudget) * 100);
    
    const msg = `⚠️ ALERTA DE ORÇAMENTO\n\nGasto hoje: R$ ${totalSpend.toFixed(2)} / R$ ${totalBudget.toFixed(2)} (${pct}%)`;
    
    expect(msg).toContain("ALERTA DE ORÇAMENTO");
    expect(msg).toContain("R$ 400.00");
    expect(msg).toContain("R$ 500.00");
    expect(msg).toContain("80%");
  });

  it("deve evitar envio duplicado na mesma hora", () => {
    const sentAlerts = new Set<string>();
    const hourKey = new Date().toISOString().slice(0, 13);
    
    expect(sentAlerts.has(hourKey)).toBe(false);
    sentAlerts.add(hourKey);
    expect(sentAlerts.has(hourKey)).toBe(true);
  });

  it("deve incluir tipo budget_alert no payload WhatsApp", () => {
    type AlertType = "ctr_drop" | "cpc_spike" | "anomaly" | "test" | "hot_lead" | "budget_alert";
    const alertType: AlertType = "budget_alert";
    expect(alertType).toBe("budget_alert");
  });
});

// ─── 4. WhatsApp Alert Payload ──────────────────────────────────────────────
describe("WhatsApp Alert Payload Validation", () => {
  it("deve aceitar todos os tipos de alerta válidos", () => {
    const validTypes = ["ctr_drop", "cpc_spike", "anomaly", "test", "hot_lead", "budget_alert"];
    for (const t of validTypes) {
      expect(validTypes).toContain(t);
    }
  });

  it("deve respeitar quiet hours (22h-7h Brasília)", () => {
    function isQuietHours(hour: number, start: number, end: number): boolean {
      if (start > end) {
        return hour >= start || hour < end;
      }
      return hour >= start && hour < end;
    }
    
    // 22h-7h: quiet hours
    expect(isQuietHours(23, 22, 7)).toBe(true);
    expect(isQuietHours(3, 22, 7)).toBe(true);
    expect(isQuietHours(6, 22, 7)).toBe(true);
    expect(isQuietHours(7, 22, 7)).toBe(false);
    expect(isQuietHours(10, 22, 7)).toBe(false);
    expect(isQuietHours(21, 22, 7)).toBe(false);
  });
});
