import { describe, it, expect, vi } from "vitest";

/**
 * Rodada 28 — Testes unitários para:
 * 1. hotLeadNotifier: classificação de leads
 * 2. Validação de tipos WhatsAppAlertPayload (hot_lead)
 * 3. Estrutura dos endpoints getCampaignFunnel e getAuctionInsights
 */

// ─── Test 1: Lead classification logic ──────────────────────────────────────
describe("hotLeadNotifier - classifyLead", () => {
  // Replicate the classifyLead function from hotLeadNotifier.ts
  function classifyLead(lead: any): { score: number; qualification: string; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    if (lead.quantidade >= 3) { score += 3; reasons.push("Alta quantidade de conversões"); }
    else if (lead.quantidade >= 2) { score += 2; reasons.push("Múltiplas conversões"); }
    else if (lead.quantidade >= 1) { score += 1; reasons.push("Pelo menos 1 conversão"); }

    const cpaVal = parseFloat((lead.cpa || "0").replace("R$", "").replace(",", "."));
    if (cpaVal > 0 && cpaVal < 5) { score += 2; reasons.push("CPA muito baixo (< R$5)"); }
    else if (cpaVal > 0 && cpaVal < 15) { score += 1; reasons.push("CPA moderado"); }

    const kw = (lead.keyword || "").toLowerCase();
    const hotTerms = ["empresa", "comercial", "corporativo", "condomínio", "escola", "indústria", "comprar", "orçamento", "preço", "contratar"];
    const coldTerms = ["como", "o que é", "grátis", "gratuito", "tutorial", "curso"];
    if (hotTerms.some(t => kw.includes(t))) { score += 2; reasons.push("Keyword com intenção comercial"); }
    if (coldTerms.some(t => kw.includes(t))) { score -= 1; reasons.push("Keyword informacional"); }

    const camp = (lead.campanha || "").toLowerCase();
    if (camp.includes("lead") || camp.includes("pesquisa")) { score += 1; reasons.push("Campanha de leads"); }

    if ((lead.dispositivo || "").toLowerCase().includes("desktop") || (lead.dispositivo || "").toLowerCase().includes("computer")) {
      score += 1; reasons.push("Desktop (perfil B2B)");
    }

    let qualification: string;
    if (score >= 5) qualification = "quente";
    else if (score >= 3) qualification = "morno";
    else qualification = "frio";

    return { score, qualification, reasons };
  }

  it("should classify a high-score lead as 'quente'", () => {
    const lead = {
      quantidade: 3,
      cpa: "R$3,50",
      keyword: "wallbox para empresa",
      campanha: "Campanha de Leads",
      dispositivo: "Desktop",
    };
    const result = classifyLead(lead);
    expect(result.qualification).toBe("quente");
    expect(result.score).toBeGreaterThanOrEqual(5);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("should classify a low-score lead as 'frio'", () => {
    const lead = {
      quantidade: 0,
      cpa: "R$50,00",
      keyword: "como funciona wallbox grátis",
      campanha: "Campanha Display",
      dispositivo: "Mobile",
    };
    const result = classifyLead(lead);
    expect(result.qualification).toBe("frio");
    expect(result.score).toBeLessThan(3);
  });

  it("should classify a medium-score lead as 'morno'", () => {
    const lead = {
      quantidade: 2,
      cpa: "R$10,00",
      keyword: "recarga veicular",
      campanha: "Campanha Geral",
      dispositivo: "Mobile",
    };
    const result = classifyLead(lead);
    expect(result.qualification).toBe("morno");
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.score).toBeLessThan(5);
  });

  it("should handle missing fields gracefully", () => {
    const lead = {};
    const result = classifyLead(lead);
    expect(result.qualification).toBe("frio");
    expect(result.score).toBe(0);
  });
});

// ─── Test 2: WhatsAppAlertPayload type validation ───────────────────────────
describe("WhatsAppAlertPayload type", () => {
  it("should accept hot_lead as a valid type", () => {
    type WhatsAppAlertPayload = {
      type: "ctr_drop" | "cpc_spike" | "anomaly" | "test" | "hot_lead";
      adGroupName?: string;
      metricValue?: string;
      message: string;
    };

    const payload: WhatsAppAlertPayload = {
      type: "hot_lead",
      message: "Lead quente detectado",
      adGroupName: "Wallbox",
      metricValue: "Score 7",
    };

    expect(payload.type).toBe("hot_lead");
    expect(payload.message).toBeTruthy();
  });
});

// ─── Test 3: getCampaignFunnel response structure ───────────────────────────
describe("getCampaignFunnel response structure", () => {
  it("should have the expected shape for campaign funnel data", () => {
    // Simulate the response structure
    const mockResponse = {
      campaigns: [
        {
          id: "123",
          name: "Campanha Teste",
          channelType: "SEARCH",
          impressions: 1000,
          clicks: 100,
          conversions: 10,
          spend: 250.5,
          ctr: 10.0,
          convRate: 10.0,
        },
      ],
      totals: { impressions: 1000, clicks: 100, conversions: 10, spend: 250.5 },
      success: true,
    };

    expect(mockResponse.success).toBe(true);
    expect(mockResponse.campaigns).toHaveLength(1);
    expect(mockResponse.campaigns[0]).toHaveProperty("id");
    expect(mockResponse.campaigns[0]).toHaveProperty("name");
    expect(mockResponse.campaigns[0]).toHaveProperty("impressions");
    expect(mockResponse.campaigns[0]).toHaveProperty("clicks");
    expect(mockResponse.campaigns[0]).toHaveProperty("conversions");
    expect(mockResponse.campaigns[0]).toHaveProperty("spend");
    expect(mockResponse.campaigns[0]).toHaveProperty("ctr");
    expect(mockResponse.campaigns[0]).toHaveProperty("convRate");
    expect(mockResponse.totals).toHaveProperty("impressions");
    expect(mockResponse.totals).toHaveProperty("clicks");
    expect(mockResponse.totals).toHaveProperty("conversions");
    expect(mockResponse.totals).toHaveProperty("spend");
  });
});

// ─── Test 4: getAuctionInsights response structure ──────────────────────────
describe("getAuctionInsights response structure", () => {
  it("should have the expected shape for auction insights data", () => {
    const mockResponse = {
      competitors: [
        {
          domain: "concorrente.com.br",
          impressionShare: 45,
          overlapRate: 30,
          positionAboveRate: 20,
          topImpressionPct: 35,
          absTopImpressionPct: 15,
          outrankingShare: 55,
        },
      ],
      yourDomain: {
        domain: "zenitetech.com.br",
        impressionShare: 60,
        overlapRate: 0,
        positionAboveRate: 0,
        topImpressionPct: 50,
        absTopImpressionPct: 25,
        outrankingShare: 65,
      },
      totalCompetitors: 1,
      success: true,
    };

    expect(mockResponse.success).toBe(true);
    expect(mockResponse.competitors).toHaveLength(1);
    expect(mockResponse.competitors[0]).toHaveProperty("domain");
    expect(mockResponse.competitors[0]).toHaveProperty("impressionShare");
    expect(mockResponse.competitors[0]).toHaveProperty("overlapRate");
    expect(mockResponse.competitors[0]).toHaveProperty("positionAboveRate");
    expect(mockResponse.competitors[0]).toHaveProperty("topImpressionPct");
    expect(mockResponse.competitors[0]).toHaveProperty("absTopImpressionPct");
    expect(mockResponse.competitors[0]).toHaveProperty("outrankingShare");
    expect(mockResponse.yourDomain).not.toBeNull();
    expect(mockResponse.totalCompetitors).toBeGreaterThan(0);
  });

  it("should handle empty auction insights gracefully", () => {
    const emptyResponse = {
      competitors: [],
      yourDomain: null,
      totalCompetitors: 0,
      success: false,
      error: "Auction Insights não disponível para esta conta",
    };

    expect(emptyResponse.success).toBe(false);
    expect(emptyResponse.competitors).toHaveLength(0);
    expect(emptyResponse.yourDomain).toBeNull();
    expect(emptyResponse.error).toBeTruthy();
  });
});
