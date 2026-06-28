/**
 * metaAds.test.ts
 * Validates that META_ADS_ACCESS_TOKEN and META_ADS_ACCOUNT_ID are configured
 * and that the Meta Graph API is accessible.
 */
import { describe, it, expect } from "vitest";

describe("Meta Ads Integration", () => {
  it("should have META_ADS_ACCESS_TOKEN configured", () => {
    const token = process.env.META_ADS_ACCESS_TOKEN;
    expect(token).toBeTruthy();
    expect(token!.length).toBeGreaterThan(20);
  });

  it("should have META_ADS_ACCOUNT_ID configured", () => {
    const accountId = process.env.META_ADS_ACCOUNT_ID;
    expect(accountId).toBeTruthy();
    expect(accountId!.length).toBeGreaterThan(5);
  });

  it("should be able to reach Meta Graph API with the token", async () => {
    const token = process.env.META_ADS_ACCESS_TOKEN;
    if (!token) {
      console.warn("META_ADS_ACCESS_TOKEN not set, skipping API test");
      return;
    }

    const url = `https://graph.facebook.com/v19.0/me?access_token=${token}&fields=id,name`;
    const res = await fetch(url);
    expect(res.ok).toBe(true);

    const data = await res.json() as { id?: string; name?: string; error?: unknown };
    expect(data.error).toBeUndefined();
    expect(data.id).toBeTruthy();
    expect(data.name).toBeTruthy();
  });

  it("should be able to list campaigns for the configured ad account", async () => {
    const token = process.env.META_ADS_ACCESS_TOKEN;
    const accountId = process.env.META_ADS_ACCOUNT_ID;
    if (!token || !accountId) {
      console.warn("Meta Ads credentials not set, skipping campaign test");
      return;
    }

    const url = `https://graph.facebook.com/v19.0/act_${accountId}/campaigns?access_token=${token}&fields=id,name,status&limit=3`;
    const res = await fetch(url);
    expect(res.ok).toBe(true);

    const data = await res.json() as { data?: unknown[]; error?: unknown };
    expect(data.error).toBeUndefined();
    expect(Array.isArray(data.data)).toBe(true);
  });
});
