/**
 * tRPC router for Facebook Page metrics (Zênite Tech).
 * Uses Meta Graph API Page Token for page-level data.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { META_PAGE_ID, META_ACCESS_TOKEN } from "../credentials";
// ⚠️  IDs centralizados em server/credentials.ts — não edite aqui
const ZENITE_PAGE_ID = META_PAGE_ID;

function getMetaToken(): string | null {
  return META_ACCESS_TOKEN || null;
}

async function fetchMetaAPI(path: string, params: Record<string, string>): Promise<any> {
  const token = getMetaToken();
  if (!token) throw new Error("META_ADS_ACCESS_TOKEN not configured");
  const qs = new URLSearchParams({ ...params, access_token: token });
  const url = `https://graph.facebook.com/v21.0/${path}?${qs.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Meta API error ${res.status}`);
  }
  return res.json();
}

// Simulated page posts when pages_read_engagement is not available
function getSimulatedPosts() {
  return [
    {
      id: "sim_post_1",
      message: "🚀 Nova solução de controle de acesso com reconhecimento facial para condomínios. Segurança e praticidade em um único sistema. Saiba mais: zenite.tech",
      created_time: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
      likes: 24,
      comments: 5,
      shares: 8,
      reach: 1240,
      permalink_url: "https://facebook.com/zenitetech",
    },
    {
      id: "sim_post_2",
      message: "💡 GuardIA: Inteligência Artificial para segurança eletrônica. Monitoramento 24h com alertas automáticos. Entre em contato e solicite uma demonstração.",
      created_time: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
      likes: 18,
      comments: 3,
      shares: 12,
      reach: 980,
      permalink_url: "https://facebook.com/zenitetech",
    },
    {
      id: "sim_post_3",
      message: "⚡ Wallbox para veículos elétricos: carregamento inteligente para empresas e condomínios. Infraestrutura completa com gestão via app.",
      created_time: new Date(Date.now() - 14 * 24 * 3600000).toISOString(),
      likes: 31,
      comments: 7,
      shares: 15,
      reach: 1580,
      permalink_url: "https://facebook.com/zenitetech",
    },
    {
      id: "sim_post_4",
      message: "📱 ZIPY: Multiatendimento via WhatsApp com IA. Responda clientes automaticamente e escale seu atendimento. Teste grátis por 14 dias.",
      created_time: new Date(Date.now() - 21 * 24 * 3600000).toISOString(),
      likes: 42,
      comments: 11,
      shares: 19,
      reach: 2100,
      permalink_url: "https://facebook.com/zenitetech",
    },
  ];
}

// Simulated page insights trend
function getSimulatedInsightsTrend(days: number) {
  const trend = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const base = 150 + Math.sin(i * 0.4) * 40;
    trend.push({
      date: d.toISOString().split("T")[0],
      impressions: Math.round(base * 12),
      reach: Math.round(base * 8),
      engagedUsers: Math.round(base * 1.2),
      pageViews: Math.round(base * 0.8),
    });
  }
  return trend;
}

export const facebookPageRouter = router({
  // Get page info and basic stats
  getPageInfo: protectedProcedure.query(async () => {
    const token = getMetaToken();
    if (!token) {
      return {
        id: ZENITE_PAGE_ID,
        name: "Zênite Tech",
        category: "Empresa de telecomunicações",
        fanCount: 638,
        followersCount: 638,
        about: "A ZÊNITE TECH é uma empresa inovadora que há 33 anos fornece tecnologias próprias, softwares e equipamentos de alta qualidade.",
        website: "https://zenite.tech/",
        phone: "+558330442750",
        coverUrl: null,
        pictureUrl: null,
        isConfigured: false,
      };
    }

    try {
      const data = await fetchMetaAPI(ZENITE_PAGE_ID, {
        fields: "id,name,fan_count,followers_count,about,website,phone,category,cover,picture",
      });

      return {
        id: data.id,
        name: data.name,
        category: data.category,
        fanCount: data.fan_count ?? 0,
        followersCount: data.followers_count ?? 0,
        about: data.about ?? "",
        website: data.website ?? "",
        phone: data.phone ?? "",
        coverUrl: data.cover?.source ?? null,
        pictureUrl: data.picture?.data?.url ?? null,
        isConfigured: true,
      };
    } catch (e: any) {
      console.error("[FacebookPage] getPageInfo error:", e.message);
      return {
        id: ZENITE_PAGE_ID,
        name: "Zênite Tech",
        category: "Empresa de telecomunicações",
        fanCount: 638,
        followersCount: 638,
        about: "",
        website: "https://zenite.tech/",
        phone: "",
        coverUrl: null,
        pictureUrl: null,
        isConfigured: true,
        error: e.message,
      };
    }
  }),

  // Get page posts (requires pages_read_engagement — falls back to simulated)
  getPagePosts: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(25).default(10) }))
    .query(async ({ input }) => {
      const token = getMetaToken();
      if (!token) {
        return { posts: getSimulatedPosts(), isSimulated: true };
      }

      try {
        const data = await fetchMetaAPI(`${ZENITE_PAGE_ID}/posts`, {
          fields: "id,message,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true),shares",
          limit: String(input.limit),
        });

        const posts = (data.data ?? []).map((p: any) => ({
          id: p.id,
          message: p.message ?? "",
          created_time: p.created_time,
          imageUrl: p.full_picture ?? null,
          permalink_url: p.permalink_url ?? "",
          likes: p.likes?.summary?.total_count ?? 0,
          comments: p.comments?.summary?.total_count ?? 0,
          shares: p.shares?.count ?? 0,
          reach: 0, // requires insights endpoint
        }));

        return { posts, isSimulated: false };
      } catch (e: any) {
        console.error("[FacebookPage] getPagePosts error:", e.message);
        // Fallback to simulated — pages_read_engagement permission needed
        return { posts: getSimulatedPosts(), isSimulated: true, permissionNeeded: "pages_read_engagement" };
      }
    }),

  // Get page insights trend (simulated — requires pages_read_engagement)
  getInsightsTrend: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(90).default(30) }))
    .query(async ({ input }) => {
      // This requires pages_read_engagement which needs app review
      // Return simulated data with clear indication
      return {
        trend: getSimulatedInsightsTrend(input.days),
        isSimulated: true,
        permissionNeeded: "pages_read_engagement",
        note: "Dados estimados. Para dados reais, a permissão pages_read_engagement precisa ser aprovada pelo Meta.",
      };
    }),

  // Get page summary (combines page info + lead forms count)
  getSummary: protectedProcedure.query(async () => {
    const token = getMetaToken();
    if (!token) {
      return {
        fanCount: 638,
        followersCount: 638,
        totalPosts: 0,
        totalLeadForms: 9,
        activeLeadForms: 5,
        totalLeads: 0,
        isConfigured: false,
      };
    }

    try {
      // Get page info
      const pageData = await fetchMetaAPI(ZENITE_PAGE_ID, {
        fields: "fan_count,followers_count,posts.limit(1){id}",
      });

      // Get lead forms count
      const formsData = await fetchMetaAPI(`${ZENITE_PAGE_ID}/leadgen_forms`, {
        fields: "id,status,leads_count",
      });

      const forms = formsData.data ?? [];
      const activeForms = forms.filter((f: any) => f.status === "ACTIVE").length;
      const totalLeads = forms.reduce((sum: number, f: any) => sum + (f.leads_count ?? 0), 0);

      return {
        fanCount: pageData.fan_count ?? 0,
        followersCount: pageData.followers_count ?? 0,
        totalPosts: 0,
        totalLeadForms: forms.length,
        activeLeadForms: activeForms,
        totalLeads,
        isConfigured: true,
      };
    } catch (e: any) {
      console.error("[FacebookPage] getSummary error:", e.message);
      return {
        fanCount: 638,
        followersCount: 638,
        totalPosts: 0,
        totalLeadForms: 9,
        activeLeadForms: 5,
        totalLeads: 0,
        isConfigured: true,
        error: e.message,
      };
    }
  }),
});
