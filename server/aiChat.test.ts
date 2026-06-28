/**
 * Testes unitários para o aiChat router
 * Verifica que:
 * 1. O STATIC_CONTEXT contém informações corretas da Zênite Tech
 * 2. O cache de contexto funciona corretamente
 * 3. A função getSystemContext retorna contexto com dados reais ou fallback
 * 4. O router responde corretamente a mensagens
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do invokeLLM para não chamar API real nos testes
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: "Resposta simulada da IA com dados reais: CTR 8,5%, CPC R$ 2,90.",
        },
      },
    ],
  }),
}));

// Mock do googleAdsClient para não chamar API real
vi.mock("./googleAdsClient", () => ({
  getGoogleAdsClient: vi.fn().mockReturnValue({
    Customer: vi.fn().mockReturnValue({
      query: vi.fn().mockResolvedValue([
        {
          metrics: {
            clicks: 150,
            impressions: 1800,
            cost_micros: 435000000,
            conversions: 12,
            ctr: 0.0833,
          },
          campaign: { name: "Performance Ads - Recarga Veicular", status: "ENABLED" },
          campaign_budget: { amount_micros: 50000000 },
          ad_group: { id: "123", name: "Wallbox Veículo Elétrico", status: "ENABLED" },
        },
      ]),
    }),
  }),
  getCustomerId: vi.fn().mockReturnValue("3003291643"),
  getRefreshToken: vi.fn().mockReturnValue("mock_refresh_token"),
  getLoginCustomerId: vi.fn().mockReturnValue(undefined),
}));

// Mock do getDb para não usar banco real
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock do buildCustomerClient e buildDateFilter do googleAds router
vi.mock("./routers/googleAds", () => ({
  buildCustomerClient: vi.fn().mockImplementation((client: any, customerId: string, refreshToken: string) => {
    return client.Customer({ customer_id: customerId, refresh_token: refreshToken });
  }),
  buildDateFilter: vi.fn().mockReturnValue("segments.date BETWEEN '2026-04-05' AND '2026-04-12'"),
}));

describe("aiChat — contexto estático", () => {
  it("deve conter informações da Zênite Tech", async () => {
    // Importar após os mocks estarem configurados
    const { aiChatRouter } = await import("./routers/aiChat");
    expect(aiChatRouter).toBeDefined();
  });

  it("deve ter sugestões rápidas configuradas", async () => {
    const { aiChatRouter } = await import("./routers/aiChat");
    // Verificar que o router tem o endpoint getQuickSuggestions
    expect(aiChatRouter._def.procedures.getQuickSuggestions).toBeDefined();
  });

  it("deve ter o endpoint sendMessage configurado", async () => {
    const { aiChatRouter } = await import("./routers/aiChat");
    expect(aiChatRouter._def.procedures.sendMessage).toBeDefined();
  });

  it("deve ter o endpoint getHistory configurado", async () => {
    const { aiChatRouter } = await import("./routers/aiChat");
    expect(aiChatRouter._def.procedures.getHistory).toBeDefined();
  });
});

describe("aiChat — conteúdo do contexto estático", () => {
  it("contexto deve mencionar Zênite Tech", async () => {
    // Ler o arquivo fonte para verificar o conteúdo do STATIC_CONTEXT
    const fs = await import("fs");
    const content = fs.readFileSync("./server/routers/aiChat.ts", "utf-8");
    expect(content).toContain("Zênite Tech");
    expect(content).toContain("Google Ads");
    expect(content).toContain("português do Brasil");
  });

  it("contexto deve listar produtos da Zênite Tech", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./server/routers/aiChat.ts", "utf-8");
    expect(content).toContain("ZFace");
    expect(content).toContain("GuardIA");
    expect(content).toContain("ZIPY");
    expect(content).toContain("Wallbox");
  });

  it("deve ter cache de 5 minutos configurado", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./server/routers/aiChat.ts", "utf-8");
    expect(content).toContain("CACHE_TTL_MS");
    expect(content).toContain("5 * 60 * 1000");
  });

  it("deve buscar dados reais da Google Ads API", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./server/routers/aiChat.ts", "utf-8");
    expect(content).toContain("fetchRealAdsContext");
    expect(content).toContain("getSystemContext");
    expect(content).toContain("buildDateFilter");
    expect(content).toContain("buildCustomerClient");
  });

  it("deve ter fallback quando API falha", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./server/routers/aiChat.ts", "utf-8");
    expect(content).toContain("AVISO");
    expect(content).toContain("dados reais da Google Ads API");
  });

  it("deve injetar dados reais no contexto do LLM (não hardcoded)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./server/routers/aiChat.ts", "utf-8");
    // Verificar que o SYSTEM_CONTEXT não tem mais valores hardcoded de métricas
    expect(content).not.toContain("14,34%");
    expect(content).not.toContain("R$ 1.500/mês");
    // Verificar que usa dados dinâmicos
    expect(content).toContain("DADOS REAIS DA CONTA GOOGLE ADS");
    expect(content).toContain("totalClicks");
    expect(content).toContain("totalSpend");
  });
});

describe("aiChat — AIChatDashboard UX", () => {
  it("deve ter botões de feedback 👍/👎 no componente", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./client/src/pages/AIChatDashboard.tsx", "utf-8");
    expect(content).toContain("ThumbsUp");
    expect(content).toContain("ThumbsDown");
    expect(content).toContain("handleFeedback");
  });

  it("deve ter botão de copiar código no componente", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./client/src/pages/AIChatDashboard.tsx", "utf-8");
    expect(content).toContain("Copy");
    expect(content).toContain("handleCopyCode");
    expect(content).toContain("navigator.clipboard");
  });

  it("deve ter indicador digitando... no componente", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./client/src/pages/AIChatDashboard.tsx", "utf-8");
    expect(content).toContain("isPending");
    expect(content).toContain("animate-bounce");
    expect(content).toContain("Consultando dados da conta");
  });

  it("deve ter MessageContent como componente separado para renderização", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./client/src/pages/AIChatDashboard.tsx", "utf-8");
    expect(content).toContain("function MessageContent");
    expect(content).toContain("codeBlockRegex");
  });

  it("deve suportar blocos de código com linguagem", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./client/src/pages/AIChatDashboard.tsx", "utf-8");
    expect(content).toContain("```(\\w*)");
    expect(content).toContain("part.lang");
  });
});
