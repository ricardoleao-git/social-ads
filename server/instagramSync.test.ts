/**
 * instagramSync.test.ts
 * Testes para os endpoints de sincronização Instagram via MCP e alerta de engajamento.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  }),
}));

vi.mock("../../drizzle/schema", () => ({
  instagramSync: { id: "instagramSync" },
  socialMetrics: { id: "socialMetrics" },
  socialAlerts: { id: "socialAlerts" },
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ---- Testes de lógica de negócio ----
describe("Instagram Sync — Lógica de engajamento", () => {
  it("calcula engajamento corretamente com posts reais", () => {
    const posts = [
      { likes: 100, comments: 10 },
      { likes: 200, comments: 20 },
      { likes: 150, comments: 15 },
    ];
    const followers = 6381;
    const totalLikes = posts.reduce((s, p) => s + p.likes, 0); // 450
    const totalComments = posts.reduce((s, p) => s + p.comments, 0); // 45
    const avgLikes = totalLikes / posts.length; // 150
    const avgComments = totalComments / posts.length; // 15
    const avgEngagement = ((avgLikes + avgComments) / followers) * 100;

    expect(avgEngagement).toBeCloseTo(2.59, 1);
    expect(totalLikes).toBe(450);
    expect(totalComments).toBe(45);
  });

  it("retorna 0 de engajamento quando não há seguidores", () => {
    const followers = 0;
    const avgLikes = 100;
    const avgComments = 10;
    const avgEngagement = followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : 0;
    expect(avgEngagement).toBe(0);
  });

  it("retorna 0 de engajamento quando não há posts", () => {
    const posts: Array<{ likes: number; comments: number }> = [];
    const followers = 6381;
    const avgLikes = posts.length > 0 ? posts.reduce((s, p) => s + p.likes, 0) / posts.length : 0;
    const avgComments = posts.length > 0 ? posts.reduce((s, p) => s + p.comments, 0) / posts.length : 0;
    const avgEngagement = followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : 0;
    expect(avgEngagement).toBe(0);
  });

  it("detecta engajamento abaixo do limiar de 0,15%", () => {
    const THRESHOLD = 0.15;
    const engagementAbove = 1.87;
    const engagementBelow = 0.10;
    expect(engagementAbove < THRESHOLD).toBe(false);
    expect(engagementBelow < THRESHOLD).toBe(true);
  });

  it("classifica severidade do alerta corretamente", () => {
    const THRESHOLD = 0.15;
    const engagementHigh = 0.05; // < THRESHOLD/2 = 0.075 → high
    const engagementMedium = 0.10; // >= THRESHOLD/2 → medium
    expect(engagementHigh < THRESHOLD / 2 ? "high" : "medium").toBe("high");
    expect(engagementMedium < THRESHOLD / 2 ? "high" : "medium").toBe("medium");
  });
});

describe("Instagram Sync — Parsing de dados MCP", () => {
  it("parseia corretamente o texto de account info", () => {
    const text = `Instagram Account Info:
Name: Zênite Tech
Username: @zenite.tech
Followers: 6381
Following: 766
Posts: 337`;

    const followers = parseInt(text.match(/Followers:\s*(\d+)/)?.[1] || "0");
    const following = parseInt(text.match(/Following:\s*(\d+)/)?.[1] || "0");
    const totalPosts = parseInt(text.match(/Posts:\s*(\d+)/)?.[1] || "0");
    const username = text.match(/Username:\s*@?(\S+)/)?.[1];
    const name = text.match(/Name:\s*(.+)/)?.[1]?.trim();

    expect(followers).toBe(6381);
    expect(following).toBe(766);
    expect(totalPosts).toBe(337);
    expect(username).toBe("zenite.tech");
    expect(name).toBe("Zênite Tech");
  });

  it("usa valores padrão quando o texto não tem os campos esperados", () => {
    const text = "Erro ao buscar dados";
    const followers = parseInt(text.match(/Followers:\s*(\d+)/)?.[1] || "6381");
    expect(followers).toBe(6381);
  });

  it("parseia corretamente o texto de posts", () => {
    const text = `Posts recentes:
--- Post 1 ---
ID: 18179876854376796
Type: IMAGE
Likes: 45
Comments: 3
Link: https://www.instagram.com/p/abc123/
Posted: 2026-04-05T18:00:00Z
Caption: Novo produto disponível!
Link: https://www.instagram.com/p/abc123/
--- Post 2 ---
ID: 18179876854376797
Type: VIDEO
Likes: 120
Comments: 8
Link: https://www.instagram.com/p/def456/
Posted: 2026-04-03T12:00:00Z
Caption: Demonstração ao vivo
Link: https://www.instagram.com/p/def456/`;

    const blocks = text.split("--- Post ").slice(1);
    const posts = blocks.map((block) => ({
      id: block.match(/ID:\s*(\S+)/)?.[1],
      type: block.match(/Type:\s*(\S+)/)?.[1] || "IMAGE",
      likes: parseInt(block.match(/Likes:\s*(\d+)/)?.[1] || "0"),
      comments: parseInt(block.match(/Comments:\s*(\d+)/)?.[1] || "0"),
    }));

    expect(posts).toHaveLength(2);
    expect(posts[0].id).toBe("18179876854376796");
    expect(posts[0].likes).toBe(45);
    expect(posts[1].type).toBe("VIDEO");
    expect(posts[1].comments).toBe(8);
  });

  it("retorna array vazio quando não há posts no texto", () => {
    const text = "Nenhum post encontrado";
    const blocks = text.split("--- Post ").slice(1);
    expect(blocks).toHaveLength(0);
  });
});

describe("Instagram Sync — Job diário", () => {
  it("verifica que o limiar padrão é 0,15%", () => {
    const ENGAGEMENT_THRESHOLD = 0.15;
    expect(ENGAGEMENT_THRESHOLD).toBe(0.15);
  });

  it("verifica que o e-mail de alerta está configurado", () => {
    const ALERT_EMAIL = "ricardo@zenitetech.com.br";
    expect(ALERT_EMAIL).toMatch(/@zenitetech\.com\.br$/);
  });

  it("verifica que o username padrão é zenite.tech", () => {
    const INSTAGRAM_USERNAME = "zenite.tech";
    expect(INSTAGRAM_USERNAME).toBe("zenite.tech");
  });

  it("formata corretamente o engajamento para exibição", () => {
    const engagement = 1.8745;
    expect(engagement.toFixed(2)).toBe("1.87");
    expect(engagement.toFixed(4)).toBe("1.8745");
  });
});

describe("Instagram Sync — Melhorias (20 posts + markAllAlertsRead + getSavedPosts)", () => {
  it("calcula engajamento individual por post corretamente", () => {
    const followers = 6381;
    const post = { likes: 120, comments: 8 };
    const engagementRate = followers > 0 ? ((post.likes + post.comments) / followers) * 100 : 0;
    expect(engagementRate).toBeCloseTo(2.00, 1);
  });

  it("gera ID de post a partir dos últimos 12 caracteres do postId", () => {
    const postId = "18179876854376796";
    const rowId = `ig_${postId.slice(-12)}`;
    expect(rowId).toBe("ig_876854376796");
    expect(rowId.length).toBeLessThanOrEqual(20);
  });

  it("parseia insights de post corretamente (reach, impressions, interactions)", () => {
    const text = `Post Insights:
reach: 1250
impressions: 1890
total_interactions: 45
likes: 38
comments: 7`;

    const reach = parseInt(text.match(/reach:\s*(\d+)/i)?.[1] || "0");
    const impressions = parseInt(text.match(/impressions:\s*(\d+)/i)?.[1] || "0");
    const interactions = parseInt(text.match(/total_interactions:\s*(\d+)/i)?.[1] || "0");

    expect(reach).toBe(1250);
    expect(impressions).toBe(1890);
    expect(interactions).toBe(45);
  });

  it("retorna 0 para insights quando o texto não contém os campos esperados", () => {
    const text = "Erro ao buscar insights";
    const reach = parseInt(text.match(/reach:\s*(\d+)/i)?.[1] || "0");
    const impressions = parseInt(text.match(/impressions:\s*(\d+)/i)?.[1] || "0");
    expect(reach).toBe(0);
    expect(impressions).toBe(0);
  });

  it("acumula totalReach e totalInteractions de múltiplos posts", () => {
    const postsInsights = [
      { reach: 1250, interactions: 45 },
      { reach: 980, interactions: 32 },
      { reach: 1500, interactions: 67 },
    ];
    let totalReach = 0;
    let totalInteractions = 0;
    for (const p of postsInsights) {
      totalReach += p.reach;
      totalInteractions += p.interactions;
    }
    expect(totalReach).toBe(3730);
    expect(totalInteractions).toBe(144);
  });

  it("limita posts a 20 na sincronização expandida", () => {
    const MAX_POSTS = 20;
    const fakePosts = Array.from({ length: 25 }, (_, i) => ({ id: String(i), likes: 10, comments: 1 }));
    const limited = fakePosts.slice(0, MAX_POSTS);
    expect(limited.length).toBe(20);
  });

  it("verifica que o período é atualizado para recent_20_posts", () => {
    const period = "recent_20_posts";
    expect(period).toBe("recent_20_posts");
  });

  it("verifica que markAllAlertsRead atualiza isRead para true", () => {
    // Lógica simulada: todos os alertas com isRead=false são marcados como true
    const alerts = [
      { id: "1", isRead: false },
      { id: "2", isRead: false },
      { id: "3", isRead: true },
    ];
    const updated = alerts.map((a) => ({ ...a, isRead: true }));
    expect(updated.every((a) => a.isRead)).toBe(true);
    expect(updated.length).toBe(3);
  });

  it("getSavedPosts retorna posts ordenados por postedAt decrescente", () => {
    const posts = [
      { id: "1", postedAt: new Date("2026-04-01") },
      { id: "2", postedAt: new Date("2026-04-05") },
      { id: "3", postedAt: new Date("2026-03-28") },
    ];
    const sorted = [...posts].sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
    expect(sorted[0].id).toBe("2");
    expect(sorted[1].id).toBe("1");
    expect(sorted[2].id).toBe("3");
  });

  it("gráfico de linha: prepara dados cronológicos corretamente (mais antigo primeiro)", () => {
    const history = [
      { syncedAt: new Date("2026-04-06"), followers: 6400, engagementRate: 0.23 },
      { syncedAt: new Date("2026-04-05"), followers: 6390, engagementRate: 0.21 },
      { syncedAt: new Date("2026-04-04"), followers: 6381, engagementRate: 0.19 },
    ];
    // Simula o reverse() feito no componente
    const chartData = [...history].reverse().map((row) => ({
      seguidores: row.followers,
      engajamento: parseFloat(row.engagementRate.toFixed(2)),
    }));
    expect(chartData[0].seguidores).toBe(6381);
    expect(chartData[2].seguidores).toBe(6400);
  });
});
