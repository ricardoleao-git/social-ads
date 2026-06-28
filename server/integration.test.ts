/**
 * Integration API endpoint tests
 * Validates that the /api/integration endpoints respond correctly.
 */
import { describe, it, expect } from "vitest";

// We test the health endpoint (no auth required) and the auth middleware
// by making direct HTTP calls to the running server.
// These are lightweight smoke tests that don't require Google Ads credentials.

const BASE = "http://localhost:3000";

describe("Integration API - Health endpoint", () => {
  it("GET /api/integration/health returns status ok", async () => {
    const res = await fetch(`${BASE}/api/integration/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.system).toBe("Google Ads Dashboard");
    expect(body.endpoints).toBeDefined();
    expect(body.endpoints.receive_instagram).toBe("POST /api/integration/instagram/sync");
  });
});

describe("Integration API - Auth middleware", () => {
  it("POST /api/integration/instagram/sync without key returns 401 when INTEGRATION_API_KEY is set", async () => {
    const key = process.env.INTEGRATION_API_KEY;
    if (!key) {
      // No key configured — skip auth test
      console.log("INTEGRATION_API_KEY not set, skipping auth test");
      return;
    }

    const res = await fetch(`${BASE}/api/integration/instagram/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountHandle: "@test" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/integration/instagram/sync with valid key saves snapshot", async () => {
    const key = process.env.INTEGRATION_API_KEY;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (key) headers["X-Integration-Key"] = key;

    const res = await fetch(`${BASE}/api/integration/instagram/sync`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        accountHandle: "@test_vitest",
        accountName: "Test Account",
        followers: 100,
        reach: 500,
        likes: 80,
        engagementRate: 3.5,
        impressions: 1200,
        comments: 10,
        shares: 5,
        period: "7d",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.account).toBe("@test_vitest");
  });

  it("GET /api/integration/instagram/history returns snapshots", async () => {
    const key = process.env.INTEGRATION_API_KEY;
    const headers: Record<string, string> = {};
    if (key) headers["X-Integration-Key"] = key;

    const res = await fetch(`${BASE}/api/integration/instagram/history?limit=5`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.snapshots)).toBe(true);
  });
});
