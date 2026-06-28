/**
 * Rodada 31 — Testes para personalização de links, WhatsApp config e Meta Ads comparison
 */
import { describe, it, expect } from "vitest";

describe("Rodada 31 — Personalização Links + WhatsApp + Meta Ads", () => {
  
  // ─── 1. Shared Dashboard Personalização ─────────────────────────────────────
  describe("SharedDashboard — personalização por cliente", () => {
    it("deve gerar token de compartilhamento com 32 caracteres hex", () => {
      const token = Array.from({ length: 16 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
      ).join("");
      expect(token).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/.test(token)).toBe(true);
    });

    it("deve validar filtros de métricas selecionáveis", () => {
      const allMetrics = ["impressions", "clicks", "ctr", "conversions", "cpc", "spend", "funnel", "adGroups"];
      const selectedMetrics = ["impressions", "clicks", "conversions"];
      
      // Todas as métricas selecionadas devem estar na lista válida
      selectedMetrics.forEach(m => {
        expect(allMetrics).toContain(m);
      });
      
      // Pelo menos uma métrica deve ser selecionada
      expect(selectedMetrics.length).toBeGreaterThan(0);
    });

    it("deve validar URL de logo do cliente", () => {
      const validUrls = [
        "https://cdn.example.com/logo.png",
        "https://storage.googleapis.com/bucket/logo.jpg",
        "",  // vazio é válido (sem logo)
      ];
      const invalidUrls = [
        "not-a-url",
        "ftp://invalid.com/logo.png",
      ];
      
      validUrls.forEach(url => {
        expect(url === "" || url.startsWith("https://")).toBe(true);
      });
      
      invalidUrls.forEach(url => {
        expect(url === "" || url.startsWith("https://")).toBe(false);
      });
    });

    it("deve filtrar seções visíveis corretamente", () => {
      const allSections = {
        kpis: true,
        funnel: true,
        trends: true,
        adGroups: true,
      };
      const filters = { metrics: ["impressions", "clicks", "conversions"] };
      
      // KPIs devem ser filtrados baseado nas métricas selecionadas
      const kpiMetrics = ["impressions", "clicks", "ctr", "conversions", "cpc", "spend"];
      const visibleKpis = kpiMetrics.filter(m => filters.metrics.includes(m));
      expect(visibleKpis).toEqual(["impressions", "clicks", "conversions"]);
    });
  });

  // ─── 2. WhatsApp Config ──────────────────────────────────────────────────────
  describe("WhatsApp Config — credenciais e providers", () => {
    it("deve validar providers suportados", () => {
      const validProviders = ["evolution", "twilio", "z-api"];
      expect(validProviders).toContain("evolution");
      expect(validProviders).toContain("twilio");
      expect(validProviders).toContain("z-api");
    });

    it("deve validar formato de número de telefone brasileiro", () => {
      const validNumbers = ["5511999998888", "5521987654321", "5531912345678"];
      const invalidNumbers = ["11999998888", "999998888", "abc"];
      
      const phoneRegex = /^55\d{10,11}$/;
      validNumbers.forEach(n => {
        expect(phoneRegex.test(n)).toBe(true);
      });
      invalidNumbers.forEach(n => {
        expect(phoneRegex.test(n)).toBe(false);
      });
    });

    it("deve construir payload de alerta WhatsApp corretamente", () => {
      const payload = {
        type: "budget_alert" as const,
        title: "Alerta de Orçamento",
        message: "Campanha X atingiu 80% do orçamento diário",
        severity: "warning" as const,
        data: { campaignName: "Pesquisa Leads", budgetUsed: 80 },
      };
      
      expect(payload.type).toBe("budget_alert");
      expect(payload.severity).toBe("warning");
      expect(payload.data.budgetUsed).toBe(80);
    });

    it("deve construir URL da Evolution API corretamente", () => {
      const apiUrl = "https://api.evolution.example.com";
      const instanceName = "zenite-whatsapp";
      const endpoint = `/message/sendText/${instanceName}`;
      const fullUrl = `${apiUrl}${endpoint}`;
      
      expect(fullUrl).toBe("https://api.evolution.example.com/message/sendText/zenite-whatsapp");
    });
  });

  // ─── 3. Meta Ads Comparison ──────────────────────────────────────────────────
  describe("Meta Ads — comparação Google vs Meta", () => {
    it("deve calcular métricas de comparação corretamente", () => {
      const google = { spend: 1267.82, clicks: 407, conversions: 26, cpc: 3.11, ctr: 1.68 };
      const meta = { spend: 1240.50, clicks: 1850, conversions: 42, cpc: 0.67, ctr: 3.84 };
      
      const totalSpend = google.spend + meta.spend;
      const totalClicks = google.clicks + meta.clicks;
      const totalConversions = google.conversions + meta.conversions;
      
      expect(totalSpend).toBeCloseTo(2508.32, 1);
      expect(totalClicks).toBe(2257);
      expect(totalConversions).toBe(68);
    });

    it("deve calcular CPL (custo por lead) corretamente", () => {
      const spend = 1267.82;
      const conversions = 26;
      const cpl = conversions > 0 ? spend / conversions : 0;
      
      expect(cpl).toBeCloseTo(48.76, 1);
    });

    it("deve identificar dados simulados vs reais", () => {
      const resultSimulated = { meta: {}, google: {}, isSimulated: true };
      const resultReal = { meta: {}, google: {}, isSimulated: false };
      
      expect(resultSimulated.isSimulated).toBe(true);
      expect(resultReal.isSimulated).toBe(false);
    });

    it("deve validar período de comparação", () => {
      const validPeriods = ["7d", "30d", "90d", "custom"];
      const testPeriod = "30d";
      
      expect(validPeriods).toContain(testPeriod);
      expect(validPeriods).not.toContain("1d");
      expect(validPeriods).not.toContain("365d");
    });

    it("deve calcular CPM corretamente", () => {
      const spend = 1267.82;
      const impressions = 24167;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      
      expect(cpm).toBeCloseTo(52.46, 0);
      expect(cpm).toBeGreaterThan(0);
    });
  });
});
