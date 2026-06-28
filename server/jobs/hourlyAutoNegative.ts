/**
 * Job Horário: Gestor de Negativação — Nível 2 (Semiautomático)
 * ================================================================
 * GOVERNANÇA: Este job opera no Nível 2 da política de autonomia.
 *
 * Nível 1 (automático): Lê termos, classifica, salva candidatos, emite alertas.
 * Nível 2 (semiautomático): Monta proposta formatada e pede confirmação ao Ricardo.
 * Nível 3 (manual): Execução via endpoint /api/integration/approve-negatives.
 *
 * O job NUNCA aplica negativos automaticamente.
 * Toda aplicação exige aprovação explícita via dashboard ou comando.
 */
import cron from "node-cron";
import { GoogleAdsApi } from "google-ads-api";
import { getDb } from "../db";
import { searchTermCandidates, optimizationActions, negativeProposals } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { notifyAndSave } from "../notifyAndSave";
import { gte, eq } from "drizzle-orm";
import { INTENT_CATEGORY_TO_REASON, NEGATIVE_REASON_LABELS } from "../../shared/negativeReasons";
import { GOOGLE_ADS_MAIN_CAMPAIGN_ID, GOOGLE_ADS_REFRESH_TOKEN } from "../credentials";
// ⚠️  IDs centralizados em server/credentials.ts — não edite aqui

const CAMPAIGN_ID = GOOGLE_ADS_MAIN_CAMPAIGN_ID;

function getClient() {
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
  const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");
  return client.Customer({
    customer_id: customerId,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    login_customer_id: loginCustomerId || undefined,
  });
}

// ── Configuração de Categorias Ativas ──────────────────────────────────────
// Permite ativar/desativar categorias inteiras de negativação.
// false = categoria IGNORADA pelo job (não gera proposta nem candidato).
// Útil para campanhas específicas onde certos padrões são aceitáveis.
export const CATEGORY_ACTIVE_CONFIG: Record<string, boolean> = {
  emprego: true,          // Buscas por vagas de emprego
  gratuidade: true,       // Buscas por versão gratuita
  informacional: true,    // Buscas informacionais/conceituais
  b2c_residencial: true,  // Intenção residencial/pessoal
  preco_baixo: true,      // Busca por preço baixo/promoção
  ia_pessoal: true,       // IAs pessoais (ChatGPT, Gemini etc.)
  concorrente: true,      // Marcas concorrentes diretas
  plataforma_bot: true,   // Plataformas alternativas de chatbot
  tutorial_diy: true,     // Tutoriais e auto-instalação
  irrelevante: true,      // Termos completamente irrelevantes
  alto_custo: false,      // Alto custo sem conversão (gerido pela página SearchTerms)
};

// ── Whitelist de Fornecedores — NUNCA negativar ────────────────────────────
// Estes são fornecedores de equipamentos da Zênite Tech.
// Termos que contenham qualquer um desses padrões NUNCA devem ser negativados,
// mesmo que se encaixem em outra categoria (ex: concorrente).
export const SUPPLIER_WHITELIST: string[] = [
  "control id", "controlid", "control-id",
  "intelbras",
  "hikvision",
  "topdata",
  "henry",
];

function isSupplierTerm(term: string): boolean {
  const lower = term.toLowerCase();
  return SUPPLIER_WHITELIST.some(supplier => lower.includes(supplier));
}

// ── Regras de intenção ──────────────────────────────────────────────────────
// confidence >= 90 → proposta de alta confiança (destaque na notificação)
// confidence 70-89 → proposta de média confiança
// confidence < 70  → salvar para revisão manual sem proposta imediata
const INTENT_RULES: Array<{
  pattern: string[];
  category: string;
  reason: string;
  confidence: number;
  matchType: "EXACT" | "PHRASE" | "BROAD";
}> = [
  {
    pattern: ["vaga", "emprego", "estágio", "estagio", "trainee", "salário", "salario", "contratação", "contratacao", "rh ", " rh", "curriculo", "currículo"],
    category: "emprego",
    reason: "Busca por emprego — usuário procura trabalho, não produto B2B",
    confidence: 98,
    matchType: "PHRASE",
  },
  {
    pattern: ["gratis", "grátis", "gratuito", "gratuita", "free", "freemium", "sem custo", "de graça", "de graca"],
    category: "gratuidade",
    reason: "Busca por produto gratuito — não é nosso posicionamento premium B2B",
    confidence: 97,
    matchType: "PHRASE",
  },
  {
    pattern: ["o que é", "o que e", "como funciona", "o que significa", "definição", "definicao", "wikipedia", "conceito de", "história do", "historia do"],
    category: "informacional",
    reason: "Intenção informacional pura — usuário pesquisa conceito, não produto",
    confidence: 92,
    matchType: "PHRASE",
  },
  {
    pattern: ["residencial", "apartamento", "casa ", " casa", "doméstico", "domestico", "uso pessoal", "para casa", "condomínio residencial", "condominio residencial"],
    category: "b2c_residencial",
    reason: "Intenção B2C residencial — Zênite Tech atende exclusivamente B2B empresarial",
    confidence: 95,
    matchType: "PHRASE",
  },
  {
    pattern: ["mais barato", "mais barata", "promoção", "promocao", "oferta", "desconto", "preço baixo", "preco baixo", "barato", "barata", "economico", "econômico"],
    category: "preco_baixo",
    reason: "Busca por preço baixo — incompatível com posicionamento premium da Zênite Tech",
    confidence: 90,
    matchType: "PHRASE",
  },
  {
    pattern: ["chatgpt", "chat gpt", "gemini", "claude", "copilot", "perplexity", "grok", "bard", "llama", "mistral", "chatbot pessoal", "ia pessoal", "conversar com ia", "conversar com a ia"],
    category: "ia_pessoal",
    reason: "IA pessoal de conversa — usuário busca chatbot pessoal, não solução B2B",
    confidence: 93,
    matchType: "PHRASE",
  },
  {
    // NOTA: control id, intelbras, hikvision, topdata, henry foram REMOVIDOS desta lista
    // pois são fornecedores de equipamentos da Zênite Tech (protegidos pela SUPPLIER_WHITELIST)
    pattern: ["zkteco", "anviz", "acesso id", "acessoid", "dahua", "nice sistemas", "manychat", "botmaker", "take blip", "zendesk", "freshdesk"],
    category: "concorrente",
    reason: "Concorrente direto — usuário já pesquisa marca específica, clique seria desperdiçado",
    confidence: 96,
    matchType: "PHRASE",
  },
  {
    pattern: ["botmake", "chathub", "botpress", "rasa ", " rasa", "dialogflow", "landbot", "typebot", "tidio", "crisp chat"],
    category: "plataforma_bot",
    reason: "Plataforma de chatbot gratuita ou concorrente — usuário busca alternativa não-B2B",
    confidence: 91,
    matchType: "PHRASE",
  },
  {
    pattern: ["como instalar", "como configurar", "tutorial", "passo a passo", "faça você mesmo", "faca voce mesmo", "diy", "github", "open source", "código fonte", "codigo fonte"],
    category: "tutorial_diy",
    reason: "Intenção de auto-instalação ou tutorial — usuário quer fazer sozinho, não contratar serviço",
    confidence: 82,
    matchType: "PHRASE",
  },
  {
    pattern: ["skynet", "terminator", "robô assassino", "robo assassino", "inteligência artificial perigosa"],
    category: "irrelevante",
    reason: "Referência de ficção científica — completamente irrelevante para produtos B2B",
    confidence: 99,
    matchType: "PHRASE",
  },
];

function classifyTerm(term: string): { category: string; reason: string; confidence: number; matchType: "EXACT" | "PHRASE" | "BROAD" } | null {
  const lower = term.toLowerCase();
  for (const rule of INTENT_RULES) {
    const matched = rule.pattern.some(p => lower.includes(p));
    if (matched) {
      return {
        category: rule.category,
        reason: rule.reason,
        confidence: rule.confidence,
        matchType: rule.matchType,
      };
    }
  }
  return null;
}

// ── Formatar proposta no padrão canônico de confirmação ─────────────────────
function formatProposal(
  terms: Array<{ term: string; spend: number; clicks: number; conversions: number; reason: string; confidence: number; matchType: string }>,
  totalSpend: number,
  proposalId: string
): string {
  const termList = terms.slice(0, 10).map((t, i) =>
    `  ${i + 1}. "${t.term}" — R$ ${t.spend.toFixed(2)} gasto, ${t.clicks} cliques, ${t.conversions} conv. (${t.confidence}% confiança)`
  ).join("\n");

  const extra = terms.length > 10 ? `\n  ... e mais ${terms.length - 10} termos` : "";
  const highConf = terms.filter(t => t.confidence >= 90).length;
  const medConf = terms.filter(t => t.confidence >= 70 && t.confidence < 90).length;

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 DETECÇÃO — Gestor Operacional de Tráfego Pago
${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}

📊 EVIDÊNCIA
Identificados ${terms.length} termos com padrão de baixa intenção comercial nos últimos 7 dias.
Gasto total nesses termos: R$ ${totalSpend.toFixed(2)}
Alta confiança (≥90%): ${highConf} termos | Média confiança (70-89%): ${medConf} termos

📋 TERMOS IDENTIFICADOS
${termList}${extra}

⚡ IMPACTO ESPERADO
Redução estimada de ${Math.round((totalSpend / Math.max(totalSpend * 3, 1)) * 100 * 0.8)}% a ${Math.round((totalSpend / Math.max(totalSpend * 3, 1)) * 100 * 1.2)}% no desperdício da campanha "Pesquisa Leads".
Economia estimada: R$ ${totalSpend.toFixed(2)} por ciclo de 7 dias.

⚠️ RISCO
Baixo. Nenhum dos termos identificados indica intenção comercial B2B.
Todos os termos podem ser revertidos a qualquer momento pelo painel.

✅ AÇÃO SUGERIDA
Adicionar ${terms.length} termos como negativos de frase na campanha "Pesquisa Leads".
Tipo de correspondência: FRASE (phrase match) — mais seguro que exata.

📝 PARA APROVAR:
Acesse: https://social-ads.zenitetech.com/optimization-panel
Ou responda: APROVAR NEGATIVAS ${proposalId}

📝 PARA REVISAR ANTES DE DECIDIR:
Acesse: https://social-ads.zenitetech.com/optimization-panel

📝 PARA REJEITAR:
Responda: REJEITAR NEGATIVAS ${proposalId}

⏰ Esta proposta expira em 72 horas. Se não houver resposta, nenhuma ação será executada.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ── Executar aprovação de proposta (chamado pelo endpoint de aprovação) ──────
export async function executeApprovedProposal(proposalId: string): Promise<{ applied: number; errors: string[] }> {
  const db = await getDb();
  if (!db) return { applied: 0, errors: ["Banco de dados indisponível"] };

  const proposals = await db
    .select()
    .from(negativeProposals)
    .where(eq(negativeProposals.proposalId, proposalId));

  if (!proposals.length) return { applied: 0, errors: [`Proposta ${proposalId} não encontrada`] };

  const proposal = proposals[0];
  if (proposal.status !== "pending") {
    return { applied: 0, errors: [`Proposta ${proposalId} já foi processada (status: ${proposal.status})`] };
  }

  const terms: Array<{ term: string; matchType: string; confidence: number; reason: string }> = JSON.parse(proposal.termsJson);
  const customer = getClient();
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
  const campaignRn = `customers/${customerId}/campaigns/${CAMPAIGN_ID}`;

  let applied = 0;
  const errors: string[] = [];

  for (const t of terms) {
    try {
      await (customer as any).campaignCriteria.create([{
        campaign: campaignRn,
        negative: true,
        type: "KEYWORD",
        keyword: { text: t.term, match_type: t.matchType as any },
      }]);

      if (db) await db.insert(optimizationActions).values({
        actionType: "approved_negative",
        status: "applied",
        keyword: t.term,
        matchType: t.matchType as any,
        level: "campaign",
        campaignId: CAMPAIGN_ID,
        campaignName: "Pesquisa Leads",
        reason: `APROVADO MANUALMENTE | Proposta ${proposalId} | ${t.reason} | Confiança: ${t.confidence}%`,
        executionCycle: `approved_${proposalId}`,
      });

      applied++;
      await new Promise(r => setTimeout(r, 150));
    } catch (e: any) {
      errors.push(`"${t.term}": ${e?.message ?? String(e)}`);
    }
  }

  // Atualizar status da proposta
  await db
    .update(negativeProposals)
    .set({ status: "approved", appliedAt: new Date(), appliedCount: applied })
    .where(eq(negativeProposals.proposalId, proposalId));

  await notifyAndSave({
    title: `✅ Proposta ${proposalId} executada: ${applied} negativos aplicados`,
    content: `${applied} termos negativados com sucesso na campanha "Pesquisa Leads". ${errors.length > 0 ? `Erros: ${errors.join("; ")}` : "Sem erros."}`,
  });

  return { applied, errors };
}

// ── Job principal ────────────────────────────────────────────────────────────
export async function runHourlyAutoNegative() {
  const cycle = `hourly_${new Date().toISOString().slice(0, 16)}`;
  console.log(`[AutoNegative-L2] Iniciando ciclo: ${cycle}`);

  try {
    const customer = getClient();

    // 1. Buscar termos de pesquisa dos últimos 7 dias
    const rows = await customer.query(`
      SELECT
        search_term_view.search_term,
        search_term_view.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        campaign.name,
        campaign.id,
        ad_group.name,
        ad_group.id
      FROM search_term_view
      WHERE segments.date DURING LAST_7_DAYS
        AND metrics.impressions > 0
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 500
    `);

    // 2. Buscar negativos existentes
    const negCampRows = await customer.query(`
      SELECT campaign_criterion.keyword.text
      FROM campaign_criterion
      WHERE campaign_criterion.negative = TRUE
        AND campaign_criterion.type = 'KEYWORD'
        AND campaign.status != 'REMOVED'
      LIMIT 1000
    `);
    const negGroupRows = await customer.query(`
      SELECT ad_group_criterion.keyword.text
      FROM ad_group_criterion
      WHERE ad_group_criterion.negative = TRUE
        AND ad_group_criterion.type = 'KEYWORD'
        AND campaign.status != 'REMOVED'
      LIMIT 1000
    `);

    const existingNeg = new Set([
      ...negCampRows.map((r: any) => String(r.campaign_criterion?.keyword?.text ?? "").toLowerCase()),
      ...negGroupRows.map((r: any) => String(r.ad_group_criterion?.keyword?.text ?? "").toLowerCase()),
    ]);

    // 3. Buscar candidatos já detectados nas últimas 48h para evitar propostas duplicadas
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const db = await getDb();
    const recentCandidates = db ? await db
      .select({ term: searchTermCandidates.term })
      .from(searchTermCandidates)
      .where(gte(searchTermCandidates.detectedAt, twoDaysAgo)) : [];
    const recentTerms = new Set(recentCandidates.map((c: any) => c.term.toLowerCase()));

    // 4. Classificar termos e separar por nível de confiança
    const proposalTerms: Array<{ term: string; spend: number; clicks: number; conversions: number; reason: string; confidence: number; matchType: string; category: string; campaignName: string; adGroupName: string; impressions: number }> = [];
    const pendingReviewTerms: typeof proposalTerms = [];
    let skipped = 0;

    for (const row of rows) {
      const term = String((row as any).search_term_view?.search_term ?? "");
      if (!term) continue;

      const termLower = term.toLowerCase();
      const spend = Number((row as any).metrics?.cost_micros ?? 0) / 1e6;
      const clicks = Number((row as any).metrics?.clicks ?? 0);
      const impressions = Number((row as any).metrics?.impressions ?? 0);
      const conversions = Number((row as any).metrics?.conversions ?? 0);
      const campaignName = String((row as any).campaign?.name ?? "");
      const adGroupName = String((row as any).ad_group?.name ?? "");

      if (existingNeg.has(termLower)) { skipped++; continue; }
      if (recentTerms.has(termLower)) { skipped++; continue; }

      // ⚠️ Proteção de fornecedores: nunca negativar termos de fornecedores
      if (isSupplierTerm(term)) {
        console.log(`[AutoNegative-L2] Termo "${term}" protegido — fornecedor da Zênite Tech. Ignorado.`);
        skipped++;
        continue;
      }

      const classification = classifyTerm(term);
      if (!classification) continue;

      // Verificar se a categoria está ativa na configuração
      if (CATEGORY_ACTIVE_CONFIG[classification.category] === false) {
        skipped++;
        continue;
      }

      const termData = { term, spend, clicks, impressions, conversions, reason: classification.reason, confidence: classification.confidence, matchType: classification.matchType, category: classification.category, campaignName, adGroupName };

      if (classification.confidence >= 70) {
        proposalTerms.push(termData);
      } else {
        pendingReviewTerms.push(termData);
      }
    }

    console.log(`[AutoNegative-L2] Ciclo ${cycle}: ${proposalTerms.length} para proposta, ${pendingReviewTerms.length} para revisão manual, ${skipped} ignorados`);

    // 5. Salvar todos os candidatos no banco (Nível 1 — observação)
    for (const t of [...proposalTerms, ...pendingReviewTerms]) {
      if (db) {
        try {
          await db.insert(searchTermCandidates).values({
            term: t.term,
            campaignName: t.campaignName,
            adGroupName: t.adGroupName,
            impressions: t.impressions,
            clicks: t.clicks,
            spend: t.spend.toFixed(2) as any,
            conversions: t.conversions.toFixed(2) as any,
            intentCategory: t.category,
            reason: t.reason,
            status: t.confidence >= 70 ? "proposed" : "pending_review",
            confidence: t.confidence,
          });
        } catch (_) { /* ignora duplicatas */ }
      }
    }

    // 6. Se há termos para proposta, gerar e enviar proposta (Nível 2)
    if (proposalTerms.length > 0) {
      const proposalId = `NP-${Date.now().toString(36).toUpperCase()}`;
      const totalSpend = proposalTerms.reduce((sum, t) => sum + t.spend, 0);
      const proposalText = formatProposal(proposalTerms, totalSpend, proposalId);

      // Salvar proposta no banco
      if (db) {
        try {
          await db.insert(negativeProposals).values({
            proposalId,
            status: "pending",
            termsJson: JSON.stringify(proposalTerms.map(t => ({ term: t.term, matchType: t.matchType, confidence: t.confidence, reason: t.reason }))),
            termCount: proposalTerms.length,
            totalSpend: totalSpend.toFixed(2) as any,
            campaignId: CAMPAIGN_ID,
            campaignName: "Pesquisa Leads",
            executionCycle: cycle,
            expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72h
          });
        } catch (e: any) {
          console.error("[AutoNegative-L2] Erro ao salvar proposta:", e?.message);
        }
      }

      // Notificar Ricardo com a proposta formatada (Nível 2 — pedido de confirmação)
      await notifyAndSave({
        title: `🔍 Proposta ${proposalId}: ${proposalTerms.length} negativos aguardam sua aprovação`,
        content: proposalText,
      });

      console.log(`[AutoNegative-L2] Proposta ${proposalId} enviada com ${proposalTerms.length} termos (R$ ${totalSpend.toFixed(2)} em risco)`);
    }

    // 7. Notificar sobre termos em revisão manual (se houver)
    if (pendingReviewTerms.length > 0) {
      await notifyAndSave({
        title: `📋 ${pendingReviewTerms.length} termos para revisão manual no painel`,
        content: `${pendingReviewTerms.length} termos com confiança abaixo de 70% foram detectados e salvos para revisão manual.\nAcesse: https://social-ads.zenitetech.com/optimization-panel`,
      });
    }

  } catch (err: any) {
    console.error("[AutoNegative-L2] Erro crítico:", err?.message ?? err);
    await notifyAndSave({
      title: "⚠️ Erro no Gestor de Negativação",
      content: `Erro no ciclo ${new Date().toLocaleString("pt-BR")}: ${err?.message ?? String(err)}`,
    }).catch(() => {});
  }
}

// Executar a cada hora
cron.schedule(
  "0 * * * *",
  () => { runHourlyAutoNegative(); },
  { timezone: "America/Sao_Paulo" }
);

console.log("[AutoNegative-L2] Job horário agendado: a cada hora (America/Sao_Paulo) — Modo Nível 2 (proposta + confirmação)");
