import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

export const insightsRouter = router({
  /**
   * Gera recomendações estratégicas com base nos dados reais do Google Ads
   * usando o LLM integrado ao Manus.
   */
  generateInsights: protectedProcedure
    .input(
      z.object({
        summary: z.object({
          totalImpressions: z.number(),
          totalClicks: z.number(),
          avgCTR: z.number(),
          avgCPC: z.number(),
          totalConversions: z.number(),
          totalSpend: z.number(),
          dateRange: z.string().optional(),
        }),
        topGroups: z.array(
          z.object({
            name: z.string(),
            ctr: z.number(),
            cpc: z.number(),
            conversions: z.number(),
            clicks: z.number(),
            spend: z.number().optional(),
            status: z.string().optional(),
          })
        ).max(13),
        period: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { summary, topGroups, period } = input;

      // Ordenar grupos por CTR decrescente
      const sortedByCTR = [...topGroups].sort((a, b) => b.ctr - a.ctr);
      const top3 = sortedByCTR.slice(0, 3);
      const bottom3 = sortedByCTR.slice(-3).reverse();

      // Grupos sem conversão mas com gasto
      const noConversionGroups = topGroups.filter(
        (g) => g.conversions === 0 && (g.spend ?? 0) > 0
      );

      // Grupos com CTR abaixo de 5%
      const lowCTRGroups = topGroups.filter((g) => g.ctr < 5 && g.clicks > 0);

      const prompt = `Você é um especialista em Google Ads com foco em performance B2B para empresas de tecnologia, segurança eletrônica, mobilidade elétrica e comunicação inteligente via WhatsApp.

Analise os dados reais de campanhas do Google Ads abaixo e gere recomendações estratégicas objetivas, priorizando ações de alto impacto.

## Dados do Período: ${summary.dateRange ?? period ?? "Últimos 7 dias"}

### Resumo Geral
- Impressões: ${summary.totalImpressions.toLocaleString("pt-BR")}
- Cliques: ${summary.totalClicks.toLocaleString("pt-BR")}
- CTR Médio: ${summary.avgCTR.toFixed(2)}%
- CPC Médio: R$ ${summary.avgCPC.toFixed(2)}
- Conversões: ${summary.totalConversions}
- Gasto Total: R$ ${summary.totalSpend.toFixed(2)}
- Taxa de Conversão Geral: ${summary.totalClicks > 0 ? ((summary.totalConversions / summary.totalClicks) * 100).toFixed(2) : "0.00"}%

### Top 3 Grupos por CTR
${top3.map((g, i) => `${i + 1}. ${g.name}: CTR ${g.ctr.toFixed(2)}%, CPC R$ ${g.cpc.toFixed(2)}, ${g.conversions} conversões, ${g.clicks} cliques`).join("\n")}

### Bottom 3 Grupos por CTR
${bottom3.map((g, i) => `${i + 1}. ${g.name}: CTR ${g.ctr.toFixed(2)}%, CPC R$ ${g.cpc.toFixed(2)}, ${g.conversions} conversões, ${g.clicks} cliques`).join("\n")}

${noConversionGroups.length > 0 ? `### Grupos com Gasto Sem Conversão (${noConversionGroups.length} grupos)\n${noConversionGroups.map((g) => `- ${g.name}: R$ ${(g.spend ?? 0).toFixed(2)} gasto, ${g.clicks} cliques, CTR ${g.ctr.toFixed(2)}%`).join("\n")}` : ""}

${lowCTRGroups.length > 0 ? `### Grupos com CTR Abaixo de 5% (${lowCTRGroups.length} grupos)\n${lowCTRGroups.map((g) => `- ${g.name}: CTR ${g.ctr.toFixed(2)}%, ${g.clicks} cliques`).join("\n")}` : ""}

## Instruções para a resposta
Gere exatamente 5 recomendações estratégicas numeradas, cada uma com:
1. **Título curto** (máximo 8 palavras)
2. **Diagnóstico** (1 frase sobre o problema ou oportunidade identificada)
3. **Ação recomendada** (1-2 frases específicas e acionáveis)
4. **Impacto esperado** (estimativa qualitativa: Alto/Médio/Baixo)
5. **Prioridade**: 🔴 Urgente | 🟡 Importante | 🟢 Oportunidade

Seja direto, técnico e orientado a resultado. Não use linguagem genérica. Base cada recomendação nos dados fornecidos.`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "Você é um consultor especialista em Google Ads B2B. Responda em português do Brasil com tom profissional, direto e orientado a resultados. Formate a resposta em Markdown.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const content =
        response?.choices?.[0]?.message?.content ?? "Não foi possível gerar insights no momento.";

      return {
        insights: content,
        generatedAt: new Date().toISOString(),
        dataPoints: {
          totalGroups: topGroups.length,
          noConversionCount: noConversionGroups.length,
          lowCTRCount: lowCTRGroups.length,
        },
      };
    }),
});
