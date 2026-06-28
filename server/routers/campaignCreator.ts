/**
 * campaignCreator.ts
 * tRPC router para criação de campanhas, grupos de anúncios e RSA via Google Ads REST API v20.
 * Usa fetch direto (REST) para máxima compatibilidade com a versão mais recente da API.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { GOOGLE_ADS_REFRESH_TOKEN } from "../credentials";

// ─── Helpers REST ─────────────────────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Falha ao obter access token: " + JSON.stringify(data));
  return data.access_token;
}

function adsHeaders(token: string) {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!;
  return {
    Authorization: `Bearer ${token}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    "Content-Type": "application/json",
    "login-customer-id": customerId,
  };
}

async function adsPost(endpoint: string, payload: object, token: string) {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!;
  const url = `https://googleads.googleapis.com/v20/customers/${customerId}/${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: adsHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const errMsg = JSON.stringify(data).slice(0, 500);
    throw new Error(`Google Ads API error ${res.status}: ${errMsg}`);
  }
  return data;
}

async function adsSearch(query: string, token: string) {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!;
  const url = `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:search`;
  const res = await fetch(url, {
    method: "POST",
    headers: adsHeaders(token),
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Ads search error: ${JSON.stringify(data).slice(0, 300)}`);
  return data.results || [];
}

// ─── Schemas ──────────────────────────────────────────────────────────────────
const KeywordSchema = z.object({
  text: z.string(),
  matchType: z.enum(["EXACT", "PHRASE", "BROAD"]),
});

const HeadlineSchema = z.object({ text: z.string().max(30) });
const DescriptionSchema = z.object({ text: z.string().max(90) });

// ─── Router ───────────────────────────────────────────────────────────────────
export const campaignCreatorRouter = router({

  // ── Listar campanhas existentes ──────────────────────────────────────────────
  listCampaigns: protectedProcedure.query(async () => {
    const token = await getAccessToken();
    const rows = await adsSearch(
      `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
              campaign_budget.amount_micros
       FROM campaign
       WHERE campaign.status != 'REMOVED'
       ORDER BY campaign.name`,
      token
    );
    return rows.map((r: any) => ({
      id: r.campaign.id,
      name: r.campaign.name,
      status: r.campaign.status,
      type: r.campaign.advertisingChannelType,
      budgetDay: r.campaignBudget ? (r.campaignBudget.amountMicros / 1_000_000).toFixed(2) : null,
    }));
  }),

  // ── Listar grupos de uma campanha ────────────────────────────────────────────
  listAdGroups: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input }) => {
      const token = await getAccessToken();
      const rows = await adsSearch(
        `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.cpc_bid_micros
         FROM ad_group
         WHERE campaign.id = '${input.campaignId}'
         AND ad_group.status != 'REMOVED'`,
        token
      );
      return rows.map((r: any) => ({
        id: r.adGroup.id,
        name: r.adGroup.name,
        status: r.adGroup.status,
        cpcBid: r.adGroup.cpcBidMicros ? (r.adGroup.cpcBidMicros / 1_000_000).toFixed(2) : null,
      }));
    }),

  // ── Sugestão de IA para campanha ─────────────────────────────────────────────
  suggestCampaign: protectedProcedure
    .input(z.object({
      product: z.string(),
      goal: z.string(),
      budget: z.number(),
    }))
    .mutation(async ({ input }) => {
      const prompt = `Você é um especialista em Google Ads para a empresa Zênite Tech, que oferece soluções B2B de tecnologia (segurança eletrônica, controle de acesso, IA no WhatsApp, Wallbox para veículos elétricos, relógio de ponto, câmeras com reconhecimento facial, PABX em nuvem).

O usuário quer criar uma campanha de pesquisa para o produto/serviço: "${input.product}"
Objetivo: ${input.goal}
Orçamento diário: R$ ${input.budget}

Retorne um JSON com:
{
  "campaignName": "nome sugerido para a campanha (máx 50 chars)",
  "adGroupName": "nome do grupo de anúncios principal (máx 50 chars)",
  "keywords": [
    {"text": "palavra-chave", "matchType": "EXACT|PHRASE|BROAD"},
    ... (8 a 12 palavras-chave relevantes, sem repetição, foco em intenção comercial)
  ],
  "headlines": [
    {"text": "título (máx 30 chars)"},
    ... (exatamente 10 títulos)
  ],
  "descriptions": [
    {"text": "descrição (máx 90 chars)"},
    ... (exatamente 3 descrições)
  ],
  "finalUrl": "URL de destino mais relevante do site zenitetech.com",
  "path1": "caminho1 (máx 15 chars)",
  "path2": "caminho2 (máx 15 chars)",
  "rationale": "breve explicação da estratégia (2-3 frases)"
}

Regras importantes:
- Títulos: máximo 30 caracteres cada (CRÍTICO)
- Descrições: máximo 90 caracteres cada (CRÍTICO)
- Palavras-chave: foco em intenção de compra, sem termos genéricos demais
- Use correspondência exata para termos de alta intenção, frase para variações
- URLs válidas: https://zenitetech.com, https://zenitetech.com/wallbox, https://zenitetech.com/guardia, https://zenitetech.com/zipy, https://zenitetech.com/controle-de-acesso, https://zenitetech.com/relogio-de-ponto`;

      const result = await invokeLLM({
        messages: [
          { role: "system", content: "Você é um especialista em Google Ads. Retorne apenas JSON válido, sem markdown." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const content = result.choices[0].message.content;
      return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    }),

  // ── Sugestão de IA para grupo de anúncios ────────────────────────────────────
  suggestAdGroup: protectedProcedure
    .input(z.object({
      campaignName: z.string(),
      product: z.string(),
      segment: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const prompt = `Você é especialista em Google Ads para a Zênite Tech (tecnologia B2B).

Campanha existente: "${input.campaignName}"
Produto/serviço: "${input.product}"
Segmento alvo: "${input.segment || 'geral'}"

Sugira um novo grupo de anúncios. Retorne JSON:
{
  "adGroupName": "nome do grupo (máx 50 chars)",
  "keywords": [
    {"text": "palavra-chave", "matchType": "EXACT|PHRASE|BROAD"},
    ... (6 a 10 palavras-chave)
  ],
  "headlines": [
    {"text": "título (máx 30 chars)"},
    ... (exatamente 8 títulos)
  ],
  "descriptions": [
    {"text": "descrição (máx 90 chars)"},
    ... (exatamente 2 descrições)
  ],
  "finalUrl": "URL relevante do zenitetech.com",
  "rationale": "justificativa (1-2 frases)"
}

Regras: títulos máx 30 chars, descrições máx 90 chars.`;

      const result = await invokeLLM({
        messages: [
          { role: "system", content: "Especialista Google Ads. Retorne apenas JSON válido." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const _c = result.choices[0].message.content; return JSON.parse(typeof _c === "string" ? _c : JSON.stringify(_c));
    }),

  // ── Criar campanha completa (campanha + grupo + palavras-chave + RSA) ─────────
  createFullCampaign: protectedProcedure
    .input(z.object({
      // Campanha
      campaignName: z.string().min(3).max(100),
      budgetDayBRL: z.number().min(1).max(500),
      // Grupo
      adGroupName: z.string().min(3).max(100),
      cpcBidBRL: z.number().min(0.1).max(50),
      // Palavras-chave
      keywords: z.array(KeywordSchema).min(1).max(20),
      // RSA
      headlines: z.array(HeadlineSchema).min(3).max(15),
      descriptions: z.array(DescriptionSchema).min(2).max(4),
      finalUrl: z.string().url(),
      path1: z.string().max(15).optional(),
      path2: z.string().max(15).optional(),
    }))
    .mutation(async ({ input }) => {
      const token = await getAccessToken();
      const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!;
      const results: Record<string, any> = {};

      // 1. Criar orçamento
      const budgetResult = await adsPost("campaignBudgets:mutate", {
        operations: [{
          create: {
            name: `Orçamento - ${input.campaignName}`,
            amountMicros: Math.round(input.budgetDayBRL * 1_000_000),
            deliveryMethod: "STANDARD",
          }
        }]
      }, token);
      const budgetResource = budgetResult.results[0].resourceName;
      results.budgetId = budgetResource.split("/").pop();

      // 2. Criar campanha
      const campaignResult = await adsPost("campaigns:mutate", {
        operations: [{
          create: {
            name: input.campaignName,
            status: "PAUSED",
            advertisingChannelType: "SEARCH",
            campaignBudget: budgetResource,
            manualCpc: { enhancedCpcEnabled: false },
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: false,
              targetContentNetwork: false,
              targetPartnerSearchNetwork: false,
            },
            containsEuPoliticalAdvertising: 2, // NOT_EU_POLITICAL
          }
        }]
      }, token);
      const campaignResource = campaignResult.results[0].resourceName;
      results.campaignId = campaignResource.split("/").pop();

      // 3. Criar grupo de anúncios
      const adGroupResult = await adsPost("adGroups:mutate", {
        operations: [{
          create: {
            name: input.adGroupName,
            campaign: campaignResource,
            status: "ENABLED",
            type: "SEARCH_STANDARD",
            cpcBidMicros: Math.round(input.cpcBidBRL * 1_000_000),
          }
        }]
      }, token);
      const adGroupResource = adGroupResult.results[0].resourceName;
      results.adGroupId = adGroupResource.split("/").pop();

      // 4. Criar palavras-chave
      const kwOps = input.keywords.map(kw => ({
        create: {
          adGroup: adGroupResource,
          status: "ENABLED",
          keyword: {
            text: kw.text,
            matchType: kw.matchType,
          }
        }
      }));
      const kwResult = await adsPost("adGroupCriteria:mutate", { operations: kwOps }, token);
      results.keywordsCreated = kwResult.results?.length || 0;

      // 5. Criar anúncio RSA
      const rsaResult = await adsPost("adGroupAds:mutate", {
        operations: [{
          create: {
            adGroup: adGroupResource,
            status: "ENABLED",
            ad: {
              finalUrls: [input.finalUrl],
              responsiveSearchAd: {
                headlines: input.headlines,
                descriptions: input.descriptions,
                ...(input.path1 ? { path1: input.path1 } : {}),
                ...(input.path2 ? { path2: input.path2 } : {}),
              }
            }
          }
        }]
      }, token);
      results.adId = rsaResult.results[0].resourceName.split("~").pop();

      return {
        success: true,
        campaignId: results.campaignId,
        adGroupId: results.adGroupId,
        adId: results.adId,
        keywordsCreated: results.keywordsCreated,
        message: `Campanha "${input.campaignName}" criada com sucesso! Status: PAUSADA (ative quando pronto).`,
        adsLink: `https://ads.google.com/aw/adgroups?campaignId=${results.campaignId}`,
      };
    }),

  // ── Adicionar grupo a campanha existente ─────────────────────────────────────
  addAdGroupToCampaign: protectedProcedure
    .input(z.object({
      campaignId: z.string(),
      adGroupName: z.string().min(3).max(100),
      cpcBidBRL: z.number().min(0.1).max(50),
      keywords: z.array(KeywordSchema).min(1).max(20),
      headlines: z.array(HeadlineSchema).min(3).max(15),
      descriptions: z.array(DescriptionSchema).min(2).max(4),
      finalUrl: z.string().url(),
      path1: z.string().max(15).optional(),
      path2: z.string().max(15).optional(),
    }))
    .mutation(async ({ input }) => {
      const token = await getAccessToken();
      const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!;
      const campaignResource = `customers/${customerId}/campaigns/${input.campaignId}`;

      // 1. Criar grupo
      const agResult = await adsPost("adGroups:mutate", {
        operations: [{
          create: {
            name: input.adGroupName,
            campaign: campaignResource,
            status: "ENABLED",
            type: "SEARCH_STANDARD",
            cpcBidMicros: Math.round(input.cpcBidBRL * 1_000_000),
          }
        }]
      }, token);
      const adGroupResource = agResult.results[0].resourceName;
      const adGroupId = adGroupResource.split("/").pop();

      // 2. Palavras-chave
      const kwOps = input.keywords.map(kw => ({
        create: {
          adGroup: adGroupResource,
          status: "ENABLED",
          keyword: { text: kw.text, matchType: kw.matchType },
        }
      }));
      const kwResult = await adsPost("adGroupCriteria:mutate", { operations: kwOps }, token);

      // 3. RSA
      const rsaResult = await adsPost("adGroupAds:mutate", {
        operations: [{
          create: {
            adGroup: adGroupResource,
            status: "ENABLED",
            ad: {
              finalUrls: [input.finalUrl],
              responsiveSearchAd: {
                headlines: input.headlines,
                descriptions: input.descriptions,
                ...(input.path1 ? { path1: input.path1 } : {}),
                ...(input.path2 ? { path2: input.path2 } : {}),
              }
            }
          }
        }]
      }, token);

      return {
        success: true,
        adGroupId,
        keywordsCreated: kwResult.results?.length || 0,
        adId: rsaResult.results[0].resourceName.split("~").pop(),
        message: `Grupo "${input.adGroupName}" adicionado com sucesso!`,
        adsLink: `https://ads.google.com/aw/adgroups?campaignId=${input.campaignId}`,
      };
    }),

  // ── Ativar/Pausar campanha ────────────────────────────────────────────────────
  setCampaignStatus: protectedProcedure
    .input(z.object({
      campaignId: z.string(),
      status: z.enum(["ENABLED", "PAUSED"]),
    }))
    .mutation(async ({ input }) => {
      const token = await getAccessToken();
      const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!;
      await adsPost("campaigns:mutate", {
        operations: [{
          updateMask: "status",
          update: {
            resourceName: `customers/${customerId}/campaigns/${input.campaignId}`,
            status: input.status,
          }
        }]
      }, token);
      return { success: true, status: input.status };
    }),
});
