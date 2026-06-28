/**
 * Router: AI Chat — Chat inteligente para gestão de tráfego pago
 * Permite ao usuário conversar com IA para:
 *  - Consultar métricas e status das campanhas
 *  - Dar comandos de otimização (ex: "pause o grupo PABX")
 *  - Pedir análises e relatórios
 *  - Entender insights e recomendações
 *  - Registrar decisões no log de diretoria
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { aiChatMessages, optimizationActions } from "../../drizzle/schema";
import { desc } from "drizzle-orm";
import {
  getGoogleAdsClient,
  getCustomerId,
  getRefreshToken,
  getLoginCustomerId,
} from "../googleAdsClient";
import {
  buildCustomerClient,
  buildDateFilter,
  type AdGroupMetrics,
  type SummaryMetrics,
} from "./googleAds";

// ─── Contexto estático da empresa (não muda) ─────────────────────────────────
const STATIC_CONTEXT = `Você é o Assistente de Tráfego Pago da Zênite Tech — um especialista em Google Ads B2B integrado ao dashboard de gestão de campanhas.

**Empresa:** Zênite Tech (Paraíba, Brasil)
**Produtos/Serviços:**
- ZFace, ZBlock, Catraca Facial (controle de acesso biométrico)
- Relógio de Ponto Eletrônico
- GuardIA (segurança com IA para condomínios e escolas)
- ConciergIA (atendimento inteligente via WhatsApp)
- ZIPY (WhatsApp multiatendimento B2B)
- Wallbox / Recarga para Veículos Elétricos
- PABX em Nuvem

**Capacidades do sistema:**
- Análise de termos de pesquisa com classificação automática por IA
- Negativação automática de termos irrelevantes (Nível 2 — proposta + confirmação)
- Alertas de anomalia a cada 4 horas
- Sugestões de ajuste de lance semanais
- Score de RSA e sugestões de melhoria
- Relatório integrado Google Ads + Instagram
- Log de ações para diretoria

**Instruções:**
- Responda sempre em português do Brasil
- Seja direto, objetivo e orientado a resultado
- Quando o usuário pedir uma ação (ex: "pause X", "adicione negativo Y"), confirme o que será feito e registre no log
- Quando houver dados disponíveis, cite os números reais fornecidos no contexto abaixo — NUNCA invente métricas
- Sempre conclua com uma recomendação de próximo passo
- Para ações que alteram campanhas, sempre peça confirmação antes de executar
- Se não houver dados reais disponíveis para uma métrica, diga explicitamente que não tem acesso a esse dado no momento`;

// ─── Buscar dados reais da Google Ads API ────────────────────────────────────
async function fetchRealAdsContext(): Promise<string> {
  try {
    const client = getGoogleAdsClient();
    const customer = buildCustomerClient(
      client,
      getCustomerId(),
      getRefreshToken(),
      getLoginCustomerId()
    );

    // Período: últimos 7 dias
    const dateFilter = buildDateFilter("7d");

    // 1. Resumo geral
    const summaryQuery = `
      SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr
      FROM campaign
      WHERE ${dateFilter}
      AND campaign.status != 'REMOVED'
    `;
    const summaryRows = await customer.query(summaryQuery);
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalConversions = 0;
    let totalCostMicros = 0;
    for (const row of summaryRows) {
      totalClicks += Number(row.metrics?.clicks ?? 0);
      totalImpressions += Number(row.metrics?.impressions ?? 0);
      totalConversions += Number(row.metrics?.conversions ?? 0);
      totalCostMicros += Number(row.metrics?.cost_micros ?? 0);
    }
    const totalSpend = totalCostMicros / 1e6;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

    // 2. Top grupos de anúncios
    const adGroupQuery = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr
      FROM ad_group
      WHERE ${dateFilter}
      AND campaign.status != 'REMOVED'
      ORDER BY metrics.clicks DESC
      LIMIT 15
    `;
    // Mapeamento de enum numérico → string (Google Ads API retorna inteiros para status)
    const statusEnumMap: Record<number, string> = { 0: "UNSPECIFIED", 1: "UNKNOWN", 2: "ENABLED", 3: "PAUSED", 4: "REMOVED" };
    const resolveStatus = (raw: unknown): string => {
      if (typeof raw === "number") return statusEnumMap[raw] ?? "UNKNOWN";
      if (typeof raw === "string" && raw.length > 0) return raw;
      return "UNKNOWN";
    };

    const adGroupRows = await customer.query(adGroupQuery);
    const adGroups = adGroupRows.map((row: any) => {
      const clicks = Number(row.metrics?.clicks ?? 0);
      const costMicros = Number(row.metrics?.cost_micros ?? 0);
      const conversions = Number(row.metrics?.conversions ?? 0);
      const ctr = Number(row.metrics?.ctr ?? 0) * 100;
      const cpc = clicks > 0 ? costMicros / clicks / 1e6 : 0;
      const spend = costMicros / 1e6;
      return {
        name: row.ad_group?.name ?? "Desconhecido",
        status: resolveStatus(row.ad_group?.status),
        campaign: row.campaign?.name ?? "Desconhecida",
        clicks,
        impressions: Number(row.metrics?.impressions ?? 0),
        conversions,
        ctr: ctr.toFixed(2),
        cpc: cpc.toFixed(2),
        spend: spend.toFixed(2),
      };
    });

    // 3. Campanhas ativas
    const campaignQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign_budget.amount_micros,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr
      FROM campaign
      WHERE ${dateFilter}
      AND campaign.status = 'ENABLED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 10
    `;
    const campaignRows = await customer.query(campaignQuery);
    const campaigns = campaignRows.map((row: any) => {
      const clicks = Number(row.metrics?.clicks ?? 0);
      const costMicros = Number(row.metrics?.cost_micros ?? 0);
      const conversions = Number(row.metrics?.conversions ?? 0);
      const ctr = Number(row.metrics?.ctr ?? 0) * 100;
      const spend = costMicros / 1e6;
      const budgetMicros = Number(row.campaign_budget?.amount_micros ?? 0);
      const dailyBudget = budgetMicros / 1e6;
      return {
        name: row.campaign?.name ?? "Desconhecida",
        status: resolveStatus(row.campaign?.status),
        dailyBudget: dailyBudget.toFixed(2),
        clicks,
        conversions,
        ctr: ctr.toFixed(2),
        spend: spend.toFixed(2),
      };
    });

    // Montar contexto dinâmico
    const today = new Date();
    const todayStr = today.toLocaleDateString("pt-BR");

    let context = `\n\n---\n**DADOS REAIS DA CONTA GOOGLE ADS — Últimos 7 dias (atualizado em ${todayStr})**\n\n`;

    context += `**Resumo Geral (7 dias):**\n`;
    context += `- Total de cliques: ${totalClicks.toLocaleString("pt-BR")}\n`;
    context += `- Total de impressões: ${totalImpressions.toLocaleString("pt-BR")}\n`;
    context += `- Total de conversões: ${totalConversions.toLocaleString("pt-BR")}\n`;
    context += `- Gasto total: R$ ${totalSpend.toFixed(2)}\n`;
    context += `- CTR médio: ${avgCtr.toFixed(2)}%\n`;
    context += `- CPC médio: R$ ${avgCpc.toFixed(2)}\n`;
    if (cpa > 0) context += `- CPA (custo por conversão): R$ ${cpa.toFixed(2)}\n`;

    if (campaigns.length > 0) {
      context += `\n**Campanhas Ativas:**\n`;
      for (const c of campaigns) {
        context += `- ${c.name}: ${c.clicks} cliques, ${c.conversions} conversões, CTR ${c.ctr}%, gasto R$ ${c.spend}, orçamento diário R$ ${c.dailyBudget}\n`;
      }
    }

    if (adGroups.length > 0) {
      context += `\n**Top Grupos de Anúncios (por cliques):**\n`;
      for (const g of adGroups) {
        const statusPT = g.status === "ENABLED" ? "ativo" : g.status === "PAUSED" ? "pausado" : g.status.toLowerCase?.() ?? g.status;
        context += `- ${g.name} [${statusPT}] — ${g.clicks} cliques, CTR ${g.ctr}%, CPC R$ ${g.cpc}, ${g.conversions} conversões, gasto R$ ${g.spend}\n`;
      }
    }

    context += `\n*Nota: Use esses dados reais para embasar suas análises e recomendações.*\n---`;

    return context;
  } catch (error: any) {
    console.warn("[aiChat] Não foi possível buscar dados reais da Google Ads API:", error?.message);
    return `\n\n---\n**AVISO:** Não foi possível carregar dados reais da Google Ads API no momento (${error?.message ?? "erro desconhecido"}). Responda com base no contexto disponível e indique ao usuário que os dados em tempo real estão temporariamente indisponíveis.\n---`;
  }
}

// ─── Cache simples para evitar chamadas excessivas à API ─────────────────────
let _cachedContext: string | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function getSystemContext(): Promise<string> {
  const now = Date.now();
  if (_cachedContext && now - _cacheTimestamp < CACHE_TTL_MS) {
    return STATIC_CONTEXT + _cachedContext;
  }
  const dynamicContext = await fetchRealAdsContext();
  _cachedContext = dynamicContext;
  _cacheTimestamp = now;
  return STATIC_CONTEXT + dynamicContext;
}

export const aiChatRouter = router({

  // ── Enviar mensagem e receber resposta da IA ──────────────────────────────
  sendMessage: publicProcedure
    .input(z.object({
      message: z.string().min(1).max(2000),
      conversationId: z.string().optional(),
      context: z.object({
        currentPage: z.string().optional(),
        campaignName: z.string().optional(),
        selectedMetrics: z.record(z.string(), z.any()).optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();

        // Buscar histórico da conversa (últimas 10 mensagens)
        let history: Array<{ role: "user" | "assistant"; content: string }> = [];
        if (db && input.conversationId) {
          try {
            const prevMessages = await db
              .select()
              .from(aiChatMessages)
              .orderBy(desc(aiChatMessages.createdAt))
              .limit(10);
            history = prevMessages
              .reverse()
              .map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content }));
          } catch (e) { /* histórico opcional */ }
        }

        // Contexto adicional da página atual
        let contextNote = "";
        if (input.context?.currentPage) {
          contextNote = `\n[Contexto: usuário está na página "${input.context.currentPage}"${input.context.campaignName ? `, campanha "${input.context.campaignName}"` : ""}]`;
        }

        // Buscar contexto do sistema com dados reais
        const systemContext = await getSystemContext();

        // Construir mensagens para o LLM
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemContext },
          ...history,
          { role: "user", content: input.message + contextNote },
        ];

        // Chamar LLM
        const response = await invokeLLM({ messages });
        const rawContent = response?.choices?.[0]?.message?.content;
        const assistantMessage: string = typeof rawContent === "string"
          ? rawContent
          : (rawContent ? JSON.stringify(rawContent) : "Desculpe, não consegui processar sua mensagem. Tente novamente.");

        // Salvar no banco (se disponível)
        const conversationId = input.conversationId ?? `conv_${Date.now()}`;
        if (db) {
          try {
            await db.insert(aiChatMessages).values([
              {
                conversationId,
                role: "user",
                content: input.message,
                context: JSON.stringify(input.context ?? {}),
              },
              {
                conversationId,
                role: "assistant",
                content: assistantMessage,
                context: null,
              },
            ]);
          } catch (e) { /* salvar histórico é opcional */ }
        }

        // Detectar se a IA está sugerindo uma ação e registrar no log
        const actionKeywords = ["pause", "adicione negativo", "negativar", "aumentar lance", "reduzir lance", "criar grupo", "adicionar keyword"];
        const hasAction = actionKeywords.some(kw => assistantMessage.toLowerCase().includes(kw));
        if (hasAction && db) {
          try {
            await db.insert(optimizationActions).values({
              actionType: "ai_chat_suggestion",
              campaignName: input.context?.campaignName ?? "geral",
              reason: `Chat IA: "${input.message.substring(0, 100)}"`,
              status: "pending_approval",
              performanceData: JSON.stringify({ userMessage: input.message, aiResponse: assistantMessage.substring(0, 500) }),
            });
          } catch (e) { /* log opcional */ }
        }

        return {
          success: true,
          message: assistantMessage,
          conversationId,
          hasAction,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        return {
          success: false,
          message: "Erro ao processar sua mensagem. Verifique a conexão e tente novamente.",
          conversationId: input.conversationId ?? `conv_${Date.now()}`,
          hasAction: false,
          timestamp: new Date().toISOString(),
          error: error?.message,
        };
      }
    }),

  // ── Buscar histórico de uma conversa ─────────────────────────────────────
  getHistory: publicProcedure
    .input(z.object({
      conversationId: z.string(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { messages: [], success: false };

        const messages = await db
          .select()
          .from(aiChatMessages)
          .orderBy(aiChatMessages.createdAt)
          .limit(input.limit);

        return { messages, success: true };
      } catch (error: any) {
        return { messages: [], success: false, error: error?.message };
      }
    }),

  // ── Sugestões rápidas de perguntas ────────────────────────────────────────
  getQuickSuggestions: publicProcedure.query(() => {
    return {
      suggestions: [
        { id: "1", text: "Qual campanha está com melhor desempenho hoje?", category: "análise" },
        { id: "2", text: "O que precisa ser feito urgente na campanha GB Zênite?", category: "diagnóstico" },
        { id: "3", text: "Quais termos de pesquisa devo negativar esta semana?", category: "negativos" },
        { id: "4", text: "Como posso reduzir o CPC mantendo o volume de leads?", category: "otimização" },
        { id: "5", text: "Quais experimentos devo criar para melhorar o CTR?", category: "experimentos" },
        { id: "6", text: "Gere um relatório executivo para apresentar à diretoria", category: "relatório" },
        { id: "7", text: "Qual é o melhor horário para veicular anúncios B2B na Paraíba?", category: "estratégia" },
        { id: "8", text: "Como melhorar o score dos RSAs das campanhas ativas?", category: "rsa" },
        { id: "9", text: "Quais grupos de anúncios devo pausar para economizar orçamento?", category: "orçamento" },
        { id: "10", text: "Analise a performance da última semana e sugira ações", category: "análise" },
      ],
    };
  }),
});
