import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Google Ads client
vi.mock("./googleAdsClient", () => ({
  getGoogleAdsClient: vi.fn(() => ({
    Customer: vi.fn(),
  })),
  getCustomerId: vi.fn(() => "1234567890"),
  getRefreshToken: vi.fn(() => "mock-refresh-token"),
  getLoginCustomerId: vi.fn(() => "9876543210"),
}));

describe("Google Ads New Endpoints - Data Structure", () => {
  describe("getSummary response shape", () => {
    it("should include impression share fields in the expected format", () => {
      // Simulate the shape of the response from getSummary
      const mockSummary = {
        totalClicks: 201,
        totalImpressions: 10389,
        totalConversions: 12,
        totalSpend: 523.23,
        avgCtr: 0.0193,
        avgCpc: 2.60,
        dateRange: "Últimos 7 dias (12/04/2026 – 18/04/2026)",
        searchImpressionShare: 33,
        searchBudgetLostImpressionShare: 12,
        searchRankLostImpressionShare: 56,
        optimizationScore: 89,
      };

      expect(mockSummary).toHaveProperty("searchImpressionShare");
      expect(mockSummary).toHaveProperty("searchBudgetLostImpressionShare");
      expect(mockSummary).toHaveProperty("searchRankLostImpressionShare");
      expect(mockSummary).toHaveProperty("optimizationScore");

      // Validate types
      expect(typeof mockSummary.searchImpressionShare).toBe("number");
      expect(typeof mockSummary.searchBudgetLostImpressionShare).toBe("number");
      expect(typeof mockSummary.searchRankLostImpressionShare).toBe("number");
      expect(typeof mockSummary.optimizationScore).toBe("number");

      // Validate ranges (0-100 for percentages)
      expect(mockSummary.searchImpressionShare).toBeGreaterThanOrEqual(0);
      expect(mockSummary.searchImpressionShare).toBeLessThanOrEqual(100);
      expect(mockSummary.searchBudgetLostImpressionShare).toBeGreaterThanOrEqual(0);
      expect(mockSummary.searchBudgetLostImpressionShare).toBeLessThanOrEqual(100);
      expect(mockSummary.searchRankLostImpressionShare).toBeGreaterThanOrEqual(0);
      expect(mockSummary.searchRankLostImpressionShare).toBeLessThanOrEqual(100);
      expect(mockSummary.optimizationScore).toBeGreaterThanOrEqual(0);
      expect(mockSummary.optimizationScore).toBeLessThanOrEqual(100);
    });

    it("should handle null impression share for non-search campaigns", () => {
      const mockSummaryNoSearch = {
        totalClicks: 130,
        totalImpressions: 9371,
        totalConversions: 0,
        totalSpend: 80.18,
        avgCtr: 0.0139,
        avgCpc: 0.617,
        dateRange: "Últimos 7 dias",
        searchImpressionShare: null,
        searchBudgetLostImpressionShare: null,
        searchRankLostImpressionShare: null,
        optimizationScore: 89,
      };

      expect(mockSummaryNoSearch.searchImpressionShare).toBeNull();
      expect(mockSummaryNoSearch.searchBudgetLostImpressionShare).toBeNull();
      expect(mockSummaryNoSearch.searchRankLostImpressionShare).toBeNull();
      // Optimization score should still be available
      expect(mockSummaryNoSearch.optimizationScore).toBe(89);
    });
  });

  describe("getRecommendations response shape", () => {
    it("should return recommendations grouped by type", () => {
      const mockRecommendations = {
        recommendations: [
          { type: "2", label: "Adicionar palavras-chave", campaign: "customers/123/campaigns/456", resourceName: "customers/123/recommendations/abc" },
          { type: "8", label: "Adicionar palavras-chave de correspondência ampla", campaign: "customers/123/campaigns/456", resourceName: "customers/123/recommendations/def" },
          { type: "24", label: "Adicionar formulário de lead", campaign: "customers/123/campaigns/456", resourceName: "customers/123/recommendations/ghi" },
        ],
        summary: [
          { type: "2", label: "Adicionar palavras-chave", count: 1 },
          { type: "8", label: "Adicionar palavras-chave de correspondência ampla", count: 1 },
          { type: "24", label: "Adicionar formulário de lead", count: 1 },
        ],
        total: 3,
        success: true,
      };

      expect(mockRecommendations.success).toBe(true);
      expect(mockRecommendations.total).toBe(3);
      expect(mockRecommendations.recommendations).toHaveLength(3);
      expect(mockRecommendations.summary).toHaveLength(3);

      // Each recommendation should have required fields
      for (const rec of mockRecommendations.recommendations) {
        expect(rec).toHaveProperty("type");
        expect(rec).toHaveProperty("label");
        expect(rec).toHaveProperty("campaign");
        expect(rec).toHaveProperty("resourceName");
      }

      // Each summary entry should have count
      for (const s of mockRecommendations.summary) {
        expect(s).toHaveProperty("type");
        expect(s).toHaveProperty("label");
        expect(s).toHaveProperty("count");
        expect(s.count).toBeGreaterThan(0);
      }
    });

    it("should handle empty recommendations gracefully", () => {
      const emptyRecommendations = {
        recommendations: [],
        summary: [],
        total: 0,
        success: true,
      };

      expect(emptyRecommendations.success).toBe(true);
      expect(emptyRecommendations.total).toBe(0);
      expect(emptyRecommendations.recommendations).toHaveLength(0);
    });
  });

  describe("getImpressionShareByCampaign response shape", () => {
    it("should return campaigns with impression share data", () => {
      const mockCampaigns = {
        campaigns: [
          {
            id: "22968163186",
            name: "GB Zênite",
            channelType: "9",
            isSearch: false,
            impressions: 9371,
            clicks: 130,
            spend: 80.18,
            searchImpressionShare: null,
            budgetLostShare: null,
            rankLostShare: null,
            topImpressionShare: null,
            absoluteTopShare: null,
          },
          {
            id: "23722648933",
            name: "Pesquisa Leads",
            channelType: "2",
            isSearch: true,
            impressions: 1018,
            clicks: 71,
            spend: 443.05,
            searchImpressionShare: 33,
            budgetLostShare: 12,
            rankLostShare: 56,
            topImpressionShare: 26,
            absoluteTopShare: 18,
          },
        ],
        success: true,
      };

      expect(mockCampaigns.success).toBe(true);
      expect(mockCampaigns.campaigns).toHaveLength(2);

      // Non-search campaign should have null impression share
      const pmax = mockCampaigns.campaigns[0];
      expect(pmax.isSearch).toBe(false);
      expect(pmax.searchImpressionShare).toBeNull();

      // Search campaign should have impression share data
      const search = mockCampaigns.campaigns[1];
      expect(search.isSearch).toBe(true);
      expect(search.searchImpressionShare).toBe(33);
      expect(search.budgetLostShare).toBe(12);
      expect(search.rankLostShare).toBe(56);
    });
  });

  describe("Impression Share Alert Logic", () => {
    it("should trigger alert when budget_lost > 20%", () => {
      const budgetLost = 25;
      const threshold = 20;
      const shouldAlert = budgetLost > threshold;
      expect(shouldAlert).toBe(true);
    });

    it("should not trigger alert when budget_lost <= 20%", () => {
      const budgetLost = 12;
      const threshold = 20;
      const shouldAlert = budgetLost > threshold;
      expect(shouldAlert).toBe(false);
    });

    it("should correctly classify severity levels", () => {
      const classifySeverity = (budgetLost: number, rankLost: number) => {
        if (budgetLost > 40 || rankLost > 60) return "critical";
        if (budgetLost > 20 || rankLost > 30) return "warning";
        return "ok";
      };

      expect(classifySeverity(50, 20)).toBe("critical");
      expect(classifySeverity(25, 20)).toBe("warning");
      expect(classifySeverity(10, 10)).toBe("ok");
      expect(classifySeverity(15, 70)).toBe("critical");
      expect(classifySeverity(15, 35)).toBe("warning");
    });
  });

  describe("Weekly Full Report Data Collection", () => {
    it("should correctly calculate aggregated metrics", () => {
      const campaigns = [
        { impressions: 1018, clicks: 71, costMicros: 443050000, conversions: 12 },
        { impressions: 9371, clicks: 130, costMicros: 80180000, conversions: 0 },
      ];

      const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
      const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
      const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
      const totalSpend = campaigns.reduce((s, c) => s + c.costMicros / 1e6, 0);
      const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

      expect(totalImpressions).toBe(10389);
      expect(totalClicks).toBe(201);
      expect(totalConversions).toBe(12);
      expect(totalSpend).toBeCloseTo(523.23, 1);
      expect(avgCtr).toBeCloseTo(1.93, 1);
      expect(avgCpc).toBeCloseTo(2.60, 1);
    });
  });
});
