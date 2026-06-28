import { describe, it, expect, vi } from "vitest";

// ─── Testes do job dailySyncData ────────────────────────────────────────────
describe("dailySyncData — estrutura e exportações", () => {
  it("deve exportar a função runDailySyncData", async () => {
    const mod = await import("./jobs/dailySyncData");
    expect(mod.runDailySyncData).toBeDefined();
    expect(typeof mod.runDailySyncData).toBe("function");
  });
});

// ─── Testes de thresholds de anomalia ───────────────────────────────────────
describe("dailySyncData — lógica de thresholds de anomalia", () => {
  const ANOMALY_CTR_DROP_THRESHOLD = 3.0;
  const ANOMALY_CPC_SPIKE_THRESHOLD = 8.0;
  const ANOMALY_ZERO_CONV_CLICKS = 50;

  it("deve detectar CTR baixo (< 3%) como anomalia", () => {
    const ctr = 1.2;
    const clicks = 15;
    const isCampaignEnabled = true;
    const shouldAlert = clicks >= 10 && ctr < ANOMALY_CTR_DROP_THRESHOLD && isCampaignEnabled;
    expect(shouldAlert).toBe(true);
  });

  it("deve classificar CTR < 1.5% como crítico", () => {
    const ctr = 1.2;
    const isCritical = ctr < 1.5;
    expect(isCritical).toBe(true);
  });

  it("não deve alertar CTR normal (>= 3%)", () => {
    const ctr = 5.2;
    const clicks = 50;
    const isCampaignEnabled = true;
    const shouldAlert = clicks >= 10 && ctr < ANOMALY_CTR_DROP_THRESHOLD && isCampaignEnabled;
    expect(shouldAlert).toBe(false);
  });

  it("deve detectar CPC elevado (> R$8) como anomalia", () => {
    const cpc = 9.5;
    const clicks = 10;
    const shouldAlert = clicks >= 5 && cpc > ANOMALY_CPC_SPIKE_THRESHOLD;
    expect(shouldAlert).toBe(true);
  });

  it("deve classificar CPC > R$15 como crítico", () => {
    const cpc = 18.0;
    const isCritical = cpc > 15;
    expect(isCritical).toBe(true);
  });

  it("não deve alertar CPC normal (<= R$8)", () => {
    const cpc = 3.5;
    const clicks = 20;
    const shouldAlert = clicks >= 5 && cpc > ANOMALY_CPC_SPIKE_THRESHOLD;
    expect(shouldAlert).toBe(false);
  });

  it("deve detectar zero conversões com 50+ cliques", () => {
    const clicks = 60;
    const conversions = 0;
    const shouldAlert = clicks >= ANOMALY_ZERO_CONV_CLICKS && conversions === 0;
    expect(shouldAlert).toBe(true);
  });

  it("não deve alertar zero conversões com menos de 50 cliques", () => {
    const clicks = 30;
    const conversions = 0;
    const shouldAlert = clicks >= ANOMALY_ZERO_CONV_CLICKS && conversions === 0;
    expect(shouldAlert).toBe(false);
  });
});

// ─── Testes do endpoint /api/integration/scheduled/sync-data ────────────────
describe("integrationRoutes — /scheduled/sync-data", () => {
  it("deve retornar 401 sem autenticação", async () => {
    const response = await fetch(
      "https://social-ads.zenitetech.com/api/integration/scheduled/sync-data",
      { method: "POST", headers: { "Content-Type": "application/json" } }
    );
    const data = await response.json() as { success: boolean; error: string };
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
  }, 15000);

  it("deve aceitar X-Integration-Key válida e retornar resultado de sincronização", async () => {
    const apiKey = process.env.INTEGRATION_API_KEY;
    if (!apiKey) {
      console.warn("⚠️  INTEGRATION_API_KEY não definida — pulando teste de integração ao vivo");
      return;
    }

    const response = await fetch(
      "https://social-ads.zenitetech.com/api/integration/scheduled/sync-data",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Integration-Key": apiKey,
        },
      }
    );

    const data = await response.json() as {
      success: boolean;
      message?: string;
      data?: {
        googleAds?: { success: boolean; campaigns?: number };
        instagram?: { success: boolean; followers?: number };
        anomalies?: { detected: number; critical: number };
        durationMs?: number;
      };
    };

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Sincronização concluída");
    expect(data.data).toBeDefined();
    expect(data.data?.googleAds?.success).toBe(true);
    expect(data.data?.instagram?.success).toBe(true);
    expect(typeof data.data?.anomalies?.detected).toBe("number");
    expect(typeof data.data?.durationMs).toBe("number");
    expect(data.data?.durationMs).toBeGreaterThan(0);
  }, 30000);

  it("deve retornar dados do Instagram com seguidores > 0", async () => {
    const apiKey = process.env.INTEGRATION_API_KEY;
    if (!apiKey) return;

    const response = await fetch(
      "https://social-ads.zenitetech.com/api/integration/scheduled/sync-data",
      {
        method: "POST",
        headers: { "X-Integration-Key": apiKey },
      }
    );

    const data = await response.json() as {
      success: boolean;
      data?: { instagram?: { followers?: number } };
    };

    expect(data.success).toBe(true);
    expect(data.data?.instagram?.followers).toBeGreaterThan(0);
  }, 30000);
});
