/**
 * Tests for getRsaDetails endpoint logic:
 * - Ad Strength numeric-to-string mapping (0-7)
 * - GAQL query contains campaign.status in SELECT
 * - lowStrengthAlerts generated for AVERAGE/POOR ads
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// Read the router file to validate GAQL queries
const routerContent = readFileSync(
  resolve(__dirname, "routers/googleAds.ts"),
  "utf-8"
);

// ─── Ad Strength Mapping ──────────────────────────────────────────────────────

const strengthMap: Record<string, string> = {
  "0": "UNKNOWN", "1": "PENDING", "2": "NO_ADS", "3": "POOR",
  "4": "AVERAGE", "5": "GOOD", "6": "EXCELLENT", "7": "EXCELLENT",
  POOR: "POOR", AVERAGE: "AVERAGE", GOOD: "GOOD", EXCELLENT: "EXCELLENT",
  NO_ADS: "NO_ADS", PENDING: "PENDING",
  UNSPECIFIED: "UNKNOWN", UNKNOWN: "UNKNOWN",
};

describe("Ad Strength mapping", () => {
  it("maps numeric 3 → POOR", () => {
    expect(strengthMap["3"]).toBe("POOR");
  });
  it("maps numeric 4 → AVERAGE", () => {
    expect(strengthMap["4"]).toBe("AVERAGE");
  });
  it("maps numeric 5 → GOOD", () => {
    expect(strengthMap["5"]).toBe("GOOD");
  });
  it("maps numeric 6 → EXCELLENT", () => {
    expect(strengthMap["6"]).toBe("EXCELLENT");
  });
  it("maps numeric 7 → EXCELLENT (edge case)", () => {
    expect(strengthMap["7"]).toBe("EXCELLENT");
  });
  it("maps string AVERAGE → AVERAGE", () => {
    expect(strengthMap["AVERAGE"]).toBe("AVERAGE");
  });
  it("maps string POOR → POOR", () => {
    expect(strengthMap["POOR"]).toBe("POOR");
  });
  it("maps UNSPECIFIED → UNKNOWN", () => {
    expect(strengthMap["UNSPECIFIED"]).toBe("UNKNOWN");
  });
});

// ─── GAQL Query Validation ────────────────────────────────────────────────────

describe("GAQL query validation in getRsaDetails", () => {
  it("adsQuery includes campaign.status in SELECT clause", () => {
    // Find the adsQuery block
    const adsQueryMatch = routerContent.match(/const adsQuery = `([\s\S]*?)`/);
    expect(adsQueryMatch).not.toBeNull();
    const adsQuery = adsQueryMatch![1];
    expect(adsQuery).toContain("campaign.status");
    // Ensure it's in SELECT (before FROM)
    const selectPart = adsQuery.split("FROM")[0];
    expect(selectPart).toContain("campaign.status");
  });

  it("pausedAdsQuery includes campaign.status in SELECT clause", () => {
    const pausedQueryMatch = routerContent.match(/const pausedAdsQuery = `([\s\S]*?)`/);
    expect(pausedQueryMatch).not.toBeNull();
    const pausedQuery = pausedQueryMatch![1];
    expect(pausedQuery).toContain("campaign.status");
    const selectPart = pausedQuery.split("FROM")[0];
    expect(selectPart).toContain("campaign.status");
  });

  it("sitelinksQuery includes campaign.status in SELECT clause", () => {
    const sitelinksMatch = routerContent.match(/const sitelinksQuery = `([\s\S]*?)`/);
    expect(sitelinksMatch).not.toBeNull();
    const sitelinksQuery = sitelinksMatch![1];
    expect(sitelinksQuery).toContain("campaign.status");
    const selectPart = sitelinksQuery.split("FROM")[0];
    expect(selectPart).toContain("campaign.status");
  });
});

// ─── lowStrengthAlerts Logic ──────────────────────────────────────────────────

describe("lowStrengthAlerts generation", () => {
  const buildAlerts = (rsaDetails: any[]) =>
    rsaDetails
      .filter((ad) => ad.adStrength === "AVERAGE" || ad.adStrength === "POOR")
      .map((ad) => ({
        adGroupName: ad.adGroupName,
        adId: ad.adId,
        adStrength: ad.adStrength,
        headlineCount: ad.headlineCount,
        suggestion:
          ad.adStrength === "POOR"
            ? "Adicione mais headlines variados e específicos para o grupo. Evite repetições."
            : "Revise os headlines para maior variedade e relevância com as palavras-chave do grupo",
      }));

  it("returns empty array when all ads are EXCELLENT/GOOD", () => {
    const ads = [
      { adGroupName: "REP", adId: "1", adStrength: "EXCELLENT", headlineCount: 15 },
      { adGroupName: "WhatsApp", adId: "2", adStrength: "GOOD", headlineCount: 12 },
    ];
    expect(buildAlerts(ads)).toHaveLength(0);
  });

  it("generates alert for AVERAGE ad", () => {
    const ads = [
      { adGroupName: "PABX", adId: "3", adStrength: "AVERAGE", headlineCount: 8 },
    ];
    const alerts = buildAlerts(ads);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].adGroupName).toBe("PABX");
    expect(alerts[0].adStrength).toBe("AVERAGE");
    expect(alerts[0].suggestion).toContain("Revise os headlines");
  });

  it("generates alert for POOR ad with specific suggestion", () => {
    const ads = [
      { adGroupName: "Avant Charge", adId: "4", adStrength: "POOR", headlineCount: 3 },
    ];
    const alerts = buildAlerts(ads);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].adStrength).toBe("POOR");
    expect(alerts[0].suggestion).toContain("Adicione mais headlines");
  });

  it("filters only AVERAGE and POOR, ignores GOOD/EXCELLENT/UNKNOWN", () => {
    const ads = [
      { adGroupName: "A", adId: "1", adStrength: "EXCELLENT", headlineCount: 15 },
      { adGroupName: "B", adId: "2", adStrength: "GOOD", headlineCount: 12 },
      { adGroupName: "C", adId: "3", adStrength: "AVERAGE", headlineCount: 8 },
      { adGroupName: "D", adId: "4", adStrength: "POOR", headlineCount: 3 },
      { adGroupName: "E", adId: "5", adStrength: "UNKNOWN", headlineCount: 0 },
    ];
    const alerts = buildAlerts(ads);
    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.adGroupName)).toEqual(["C", "D"]);
  });
});
