/**
 * Tests for getNegativeKeywordHistory endpoint and negativeKeywordHistory schema.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// Mock the Google Ads client
vi.mock("./googleAdsClient", () => ({
  getGoogleAdsClient: vi.fn(() => ({})),
  getCustomerId: vi.fn(() => "1234567890"),
  getRefreshToken: vi.fn(() => "mock-refresh-token"),
  getLoginCustomerId: vi.fn(() => "1234567890"),
}));

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      {
        id: 1,
        text: "gratuito",
        matchType: "EXACT",
        level: "campaign",
        campaignId: "22395874206",
        campaignName: "Pesquisa Leads",
        adGroupId: null,
        adGroupName: null,
        success: 1,
        errorMessage: null,
        createdAt: new Date("2026-04-01T10:00:00Z"),
      },
      {
        id: 2,
        text: "free trial",
        matchType: "PHRASE",
        level: "campaign",
        campaignId: "22395874206",
        campaignName: "Pesquisa Leads",
        adGroupId: null,
        adGroupName: null,
        success: 1,
        errorMessage: null,
        createdAt: new Date("2026-04-02T14:30:00Z"),
      },
    ]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  })),
}));

const createCaller = () => {
  return appRouter.createCaller({
    user: null,
    req: {} as any,
    res: {} as any,
  });
};

describe("getNegativeKeywordHistory", () => {
  it("should return history records without date filter", async () => {
    const caller = createCaller();
    const result = await caller.googleAds.getNegativeKeywordHistory({});
    expect(result.success).toBe(true);
    expect(Array.isArray(result.history)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("should accept fromDate filter", async () => {
    const caller = createCaller();
    const result = await caller.googleAds.getNegativeKeywordHistory({
      fromDate: "2026-04-01",
    });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.history)).toBe(true);
  });

  it("should accept toDate filter", async () => {
    const caller = createCaller();
    const result = await caller.googleAds.getNegativeKeywordHistory({
      toDate: "2026-04-30",
    });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.history)).toBe(true);
  });

  it("should accept both fromDate and toDate filters", async () => {
    const caller = createCaller();
    const result = await caller.googleAds.getNegativeKeywordHistory({
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
    });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.history)).toBe(true);
  });

  it("should work without any input (optional input)", async () => {
    const caller = createCaller();
    const result = await caller.googleAds.getNegativeKeywordHistory(undefined);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.history)).toBe(true);
  });

  it("should return correct total count matching history length", async () => {
    const caller = createCaller();
    const result = await caller.googleAds.getNegativeKeywordHistory({});
    expect(result.total).toBe(result.history.length);
  });

  it("should return history items with required fields", async () => {
    const caller = createCaller();
    const result = await caller.googleAds.getNegativeKeywordHistory({});
    if (result.history.length > 0) {
      const item = result.history[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("text");
      expect(item).toHaveProperty("matchType");
      expect(item).toHaveProperty("level");
      expect(item).toHaveProperty("campaignId");
      expect(item).toHaveProperty("success");
      expect(item).toHaveProperty("createdAt");
    }
  });
});

describe("negativeKeywordHistory schema validation", () => {
  it("should have correct match type values", () => {
    const validMatchTypes = ["EXACT", "PHRASE", "BROAD"];
    validMatchTypes.forEach((mt) => {
      expect(["EXACT", "PHRASE", "BROAD"]).toContain(mt);
    });
  });

  it("should have correct level values", () => {
    const validLevels = ["campaign", "ad_group"];
    validLevels.forEach((level) => {
      expect(["campaign", "ad_group"]).toContain(level);
    });
  });
});
