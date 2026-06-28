/**
 * Vitest test to validate Google Ads API credentials and connectivity.
 * Tests that the environment variables are set and the API client can be instantiated.
 */
import { describe, it, expect } from "vitest";
import { getGoogleAdsClient, getCustomerId, getRefreshToken } from "./googleAdsClient";

describe("Google Ads Client", () => {
  it("should have GOOGLE_ADS_DEVELOPER_TOKEN set", () => {
    expect(process.env.GOOGLE_ADS_DEVELOPER_TOKEN).toBeTruthy();
  });

  it("should have GOOGLE_ADS_CLIENT_ID set", () => {
    expect(process.env.GOOGLE_ADS_CLIENT_ID).toBeTruthy();
  });

  it("should have GOOGLE_ADS_CLIENT_SECRET set", () => {
    expect(process.env.GOOGLE_ADS_CLIENT_SECRET).toBeTruthy();
  });

  it("should have GOOGLE_ADS_REFRESH_TOKEN set", () => {
    expect(process.env.GOOGLE_ADS_REFRESH_TOKEN).toBeTruthy();
  });

  it("should have GOOGLE_ADS_CUSTOMER_ID set", () => {
    expect(process.env.GOOGLE_ADS_CUSTOMER_ID).toBeTruthy();
  });

  it("should instantiate Google Ads client without throwing", () => {
    expect(() => getGoogleAdsClient()).not.toThrow();
  });

  it("should return customer ID", () => {
    const customerId = getCustomerId();
    expect(customerId).toBeTruthy();
    expect(customerId).toMatch(/^\d+$/);
  });

  it("should return refresh token", () => {
    const token = getRefreshToken();
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(10);
  });
});
