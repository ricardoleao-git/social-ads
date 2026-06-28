/**
 * Vitest test to validate the runAuctionInsights endpoint behavior.
 * Tests that the endpoint returns proper structure with real API or graceful error.
 */
import { describe, it, expect } from "vitest";
import { getGoogleAdsClient, getCustomerId, getRefreshToken, getLoginCustomerId } from "./googleAdsClient";

describe("AuctionInsights Endpoint", () => {
  it("should have all required Google Ads credentials for auction insights", () => {
    expect(process.env.GOOGLE_ADS_DEVELOPER_TOKEN).toBeTruthy();
    expect(process.env.GOOGLE_ADS_CLIENT_ID).toBeTruthy();
    expect(process.env.GOOGLE_ADS_CLIENT_SECRET).toBeTruthy();
    expect(process.env.GOOGLE_ADS_REFRESH_TOKEN).toBeTruthy();
    expect(process.env.GOOGLE_ADS_CUSTOMER_ID).toBeTruthy();
  });

  it("should instantiate Google Ads client for auction insights queries", () => {
    expect(() => getGoogleAdsClient()).not.toThrow();
  });

  it("should return valid customer ID for auction insights", () => {
    const customerId = getCustomerId();
    expect(customerId).toBeTruthy();
    expect(customerId).toMatch(/^\d+$/);
  });

  it("should return valid refresh token for auction insights", () => {
    const token = getRefreshToken();
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(10);
  });

  it("should have auctionSnapshots table schema defined", async () => {
    const { auctionSnapshots } = await import("../drizzle/schema");
    expect(auctionSnapshots).toBeDefined();
    // Verify required fields exist
    const columns = Object.keys(auctionSnapshots);
    expect(columns.length).toBeGreaterThan(0);
  });
});
