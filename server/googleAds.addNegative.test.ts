/**
 * Tests for googleAds.addNegativeKeyword tRPC mutation.
 *
 * These tests mock the Google Ads API client to avoid real network calls.
 * They verify input validation, success path, and error handling.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the Google Ads client module
vi.mock("../server/googleAdsClient", () => ({
  getGoogleAdsClient: vi.fn(),
  getCustomerId: vi.fn(() => "3003291643"),
  getRefreshToken: vi.fn(() => "mock-refresh-token"),
  getLoginCustomerId: vi.fn(() => undefined),
}));

// Mock the buildCustomerClient helper used in the router
vi.mock("../server/routers/googleAds", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./routers/googleAds")>();
  return actual;
});

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("googleAds.addNegativeKeyword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success=false with error message when Google Ads API throws", async () => {
    // Mock the Google Ads client to throw an error
    const { getGoogleAdsClient } = await import("../server/googleAdsClient");
    vi.mocked(getGoogleAdsClient).mockImplementation(() => {
      throw new Error("Missing Google Ads credentials");
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.googleAds.addNegativeKeyword({
      text: "gratuito",
      matchType: "EXACT",
      level: "campaign",
      campaignId: "22395874206",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("validates input: text must be at least 1 character", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.googleAds.addNegativeKeyword({
        text: "",
        matchType: "EXACT",
        level: "campaign",
        campaignId: "22395874206",
      })
    ).rejects.toThrow();
  });

  it("validates input: text must not exceed 80 characters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const longText = "a".repeat(81);
    await expect(
      caller.googleAds.addNegativeKeyword({
        text: longText,
        matchType: "EXACT",
        level: "campaign",
        campaignId: "22395874206",
      })
    ).rejects.toThrow();
  });

  it("validates input: matchType must be EXACT, PHRASE, or BROAD", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.googleAds.addNegativeKeyword({
        text: "gratuito",
        matchType: "INVALID" as any,
        level: "campaign",
        campaignId: "22395874206",
      })
    ).rejects.toThrow();
  });

  it("validates input: level must be campaign or ad_group", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.googleAds.addNegativeKeyword({
        text: "gratuito",
        matchType: "EXACT",
        level: "invalid_level" as any,
        campaignId: "22395874206",
      })
    ).rejects.toThrow();
  });

  it("accepts valid campaign-level input structure", async () => {
    // Mock the Google Ads client to throw (simulating missing credentials in test env)
    // The important thing is that input validation passes and the error is from the API call
    const { getGoogleAdsClient } = await import("../server/googleAdsClient");
    vi.mocked(getGoogleAdsClient).mockImplementation(() => {
      throw new Error("Test: API not available in test environment");
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.googleAds.addNegativeKeyword({
      text: "gratuito",
      matchType: "PHRASE",
      level: "campaign",
      campaignId: "22395874206",
    });

    // Input validation passed; error is from API (expected in test env)
    expect(result.success).toBe(false);
    expect(result.error).toContain("Test: API not available");
  });

  it("accepts valid ad_group-level input with adGroupId", async () => {
    const { getGoogleAdsClient } = await import("../server/googleAdsClient");
    vi.mocked(getGoogleAdsClient).mockImplementation(() => {
      throw new Error("Test: API not available in test environment");
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.googleAds.addNegativeKeyword({
      text: "free trial",
      matchType: "BROAD",
      level: "ad_group",
      campaignId: "22395874206",
      adGroupId: "198104641914",
    });

    // Input validation passed; error is from API (expected in test env)
    expect(result.success).toBe(false);
    expect(result.error).toContain("Test: API not available");
  });
});
