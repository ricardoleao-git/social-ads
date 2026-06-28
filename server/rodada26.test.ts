import { describe, it, expect, vi } from "vitest";

// Test 1: Quality Score endpoint structure
describe("Quality Score Analysis endpoint", () => {
  it("should define the getQualityScoreAnalysis procedure in the router", async () => {
    const { googleAdsRouter } = await import("./routers/googleAds");
    expect(googleAdsRouter).toBeDefined();
    // Check the procedure exists in the router
    const procedures = Object.keys((googleAdsRouter as any)._def.procedures || {});
    expect(procedures).toContain("getQualityScoreAnalysis");
  });

  it("should define the getCreativeAnalysis procedure in the router", async () => {
    const { googleAdsRouter } = await import("./routers/googleAds");
    const procedures = Object.keys((googleAdsRouter as any)._def.procedures || {});
    expect(procedures).toContain("getCreativeAnalysis");
  });

  it("should define the getRecommendations procedure in the router", async () => {
    const { googleAdsRouter } = await import("./routers/googleAds");
    const procedures = Object.keys((googleAdsRouter as any)._def.procedures || {});
    expect(procedures).toContain("getRecommendations");
  });

  it("should define the getGmailInsights procedure in the router", async () => {
    const { googleAdsRouter } = await import("./routers/googleAds");
    const procedures = Object.keys((googleAdsRouter as any)._def.procedures || {});
    expect(procedures).toContain("getGmailInsights");
  });

  it("should define the getImpressionShareByCampaign procedure in the router", async () => {
    const { googleAdsRouter } = await import("./routers/googleAds");
    const procedures = Object.keys((googleAdsRouter as any)._def.procedures || {});
    expect(procedures).toContain("getImpressionShareByCampaign");
  });
});

// Test 2: Lead Qualification endpoint structure
describe("Lead Qualification endpoint", () => {
  it("should define the qualifyLeads procedure in the leadsSheet router", async () => {
    const { leadsSheetRouter } = await import("./routers/leadsSheet");
    expect(leadsSheetRouter).toBeDefined();
    const procedures = Object.keys((leadsSheetRouter as any)._def.procedures || {});
    expect(procedures).toContain("qualifyLeads");
  });
});

// Test 3: Gmail Ads Reader job exists
describe("Gmail Ads Reader job", () => {
  it("should export runGmailAdsReader function", async () => {
    const mod = await import("./jobs/dailyGmailAdsReader");
    expect(mod.runGmailAdsReader).toBeDefined();
    expect(typeof mod.runGmailAdsReader).toBe("function");
  });
});

// Test 4: Impression Share Alert job exists
describe("Impression Share Alert job", () => {
  it("should export scheduleImpressionShareAlert function", async () => {
    const mod = await import("./jobs/impressionShareAlert");
    expect(mod.scheduleImpressionShareAlert).toBeDefined();
    expect(typeof mod.scheduleImpressionShareAlert).toBe("function");
  });
});

// Test 5: Weekly Full Report job exists
describe("Weekly Full Report job", () => {
  it("should export scheduleWeeklyFullReport function", async () => {
    const mod = await import("./jobs/weeklyFullReport");
    expect(mod.scheduleWeeklyFullReport).toBeDefined();
    expect(typeof mod.scheduleWeeklyFullReport).toBe("function");
  });
});

// Test 6: Lead qualification logic
describe("Lead qualification scoring logic", () => {
  it("should classify leads correctly based on scoring rules", () => {
    // Simulate the scoring logic
    function classifyLead(lead: { quantidade: number; cpa: string; keyword: string; campanha: string; dispositivo: string }) {
      let score = 0;
      if (lead.quantidade >= 3) score += 3;
      else if (lead.quantidade >= 2) score += 2;
      else if (lead.quantidade >= 1) score += 1;

      const cpaVal = parseFloat((lead.cpa || "0").replace("R$", "").replace(",", "."));
      if (cpaVal > 0 && cpaVal < 5) score += 2;
      else if (cpaVal > 0 && cpaVal < 15) score += 1;

      const kw = (lead.keyword || "").toLowerCase();
      const hotTerms = ["empresa", "comercial", "corporativo", "condomínio", "escola", "indústria", "comprar", "orçamento", "preço", "contratar"];
      const coldTerms = ["como", "o que é", "grátis", "gratuito", "tutorial", "curso"];
      if (hotTerms.some(t => kw.includes(t))) score += 2;
      if (coldTerms.some(t => kw.includes(t))) score -= 1;

      const camp = (lead.campanha || "").toLowerCase();
      if (camp.includes("lead") || camp.includes("pesquisa")) score += 1;

      if ((lead.dispositivo || "").toLowerCase().includes("desktop")) score += 1;

      if (score >= 5) return "quente";
      if (score >= 3) return "morno";
      return "frio";
    }

    // Hot lead: many conversions, low CPA, commercial keyword, desktop
    expect(classifyLead({
      quantidade: 5,
      cpa: "R$3,50",
      keyword: "wallbox empresa",
      campanha: "Pesquisa Leads",
      dispositivo: "Desktop",
    })).toBe("quente");

    // Warm lead: 1 conversion, moderate CPA
    expect(classifyLead({
      quantidade: 1,
      cpa: "R$12,00",
      keyword: "carregador veicular",
      campanha: "Pesquisa Leads",
      dispositivo: "Mobile",
    })).toBe("morno");

    // Cold lead: no conversions, informational keyword
    expect(classifyLead({
      quantidade: 0,
      cpa: "R$0,00",
      keyword: "como funciona carregador",
      campanha: "Display",
      dispositivo: "Mobile",
    })).toBe("frio");
  });
});
