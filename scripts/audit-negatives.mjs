/**
 * audit-negatives.mjs
 * 
 * Auditoria completa de palavras negativas na conta Google Ads:
 * 1. Busca TODAS as negativas (nível campanha + nível grupo)
 * 2. Busca TODOS os grupos de anúncios ativos
 * 3. Analisa cada negativa: nível correto, redundâncias, justificativa
 * 4. Executa reorganização via API (se --live)
 * 
 * Uso:
 *   node scripts/audit-negatives.mjs          # dry-run (apenas análise)
 *   node scripts/audit-negatives.mjs --live   # executa as mudanças
 */

import "dotenv/config";
import { GoogleAdsApi } from "google-ads-api";
import { writeFileSync } from "fs";

const DRY_RUN = !process.argv.includes("--live");
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID || "3003291643";
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

const customer = client.Customer({
  customer_id: CUSTOMER_ID,
  refresh_token: REFRESH_TOKEN,
  ...(LOGIN_CUSTOMER_ID ? { login_customer_id: LOGIN_CUSTOMER_ID } : {}),
});

// ─── Regras de classificação especialista ─────────────────────────────────────
// Cada regra: padrão regex, nível recomendado, justificativa detalhada
const RULES = [
  // ── NÍVEL CAMPANHA: bloquear em TODA a conta ──────────────────────────────

  { pattern: /\b(vaga|vagas|emprego|empregos|est[aá]gio|trainee|sal[aá]rio|remunera[cç][aã]o|contrata[cç][aã]o|curriculum|curr[ií]culo|recursos humanos|clt|home office)\b/i,
    level: "campaign",
    reason: "Intenção de emprego/RH — usuário busca trabalho, não solução B2B. Nível campanha bloqueia em todos os grupos simultaneamente, evitando cliques de candidatos que jamais convertem." },

  { pattern: /\b(o que [eé]|como funciona|como fazer|o que significa|defini[cç][aã]o|wikipedia|conceito|explica[cç][aã]o|tutorial|passo a passo|guia|manual|apostila|ebook)\b/i,
    level: "campaign",
    reason: "Intenção informacional pura — usuário quer aprender, não comprar. Bloquear em campanha concentra orçamento em buscas com intenção comercial real." },

  { pattern: /\b(gr[aá]tis|gratuito|gratuita|free|de gra[cç]a|sem custo|sem pagar|trial gratuito|vers[aã]o gratuita|open source|c[oó]digo aberto)\b/i,
    level: "campaign",
    reason: "Intenção de gratuidade — usuário não quer pagar. Bloquear em campanha protege posicionamento premium e evita desperdício de orçamento com leads não qualificados." },

  { pattern: /\b(control id|zkteco|anviz|nice sistemas|henry uhf|acesso id|intelbras|hikvision|dahua|axis|bosch security|honeywell|lenel|genetec|milestone|suprema|virdi|idemia|morpho|cognitec|nec biometrics)\b/i,
    level: "campaign",
    reason: "Concorrente direto identificado — usuário pesquisa marca específica da concorrência. Bloquear em campanha evita cliques de clientes fidelizados a concorrentes sem intenção real de migrar." },

  { pattern: /\b(chatgpt|chat gpt|gpt-?4|gemini|claude ai|copilot|perplexity|grok|bard|llama|mistral|chathub|botmake|skynet)\b/i,
    level: "campaign",
    reason: "IA pessoal ou plataforma concorrente de chatbot — usuário busca ferramenta pessoal/gratuita, não solução B2B paga. Bloquear em campanha evita confusão com produtos Zênite." },

  { pattern: /\b(residencial|apartamento|condom[ií]nio residencial|uso pessoal|uso dom[eé]stico|portaria residencial|interfone residencial|c[aâ]mera residencial|alarme residencial|fechadura residencial|port[aã]o residencial)\b/i,
    level: "campaign",
    reason: "Segmento B2C residencial — Zênite atende exclusivamente B2B. Bloquear em campanha evita desperdício com público completamente fora do ICP (Ideal Customer Profile)." },

  { pattern: /\b(mais barato|mais barata|barato|barata|promo[cç][aã]o|oferta|desconto|liquida[cç][aã]o|pre[cç]o baixo|menor pre[cç]o|cupom|black friday|frete gr[aá]tis)\b/i,
    level: "campaign",
    reason: "Intenção de preço baixo/promoção — usuário prioriza custo mínimo, incompatível com posicionamento de valor da Zênite. Bloquear em campanha protege qualidade dos leads." },

  { pattern: /\b(emulador|simulador|fake|bypass|hack|crack|pirata|pirataria|keygen|serial|ativa[cç][aã]o gratuita)\b/i,
    level: "campaign",
    reason: "Intenção de contornar sistema legítimo — usuário busca alternativa ilegal ou gratuita. Bloquear em campanha elimina cliques de má-fé que nunca convertem em vendas." },

  { pattern: /\b(manychat|chatfuel|take blip|blip|zendesk|freshdesk|hubspot|salesforce|rdstation|pipedrive|zoho|bitrix24|monday\.com|clickup|notion|trello|asana)\b/i,
    level: "campaign",
    reason: "Plataforma concorrente de automação/CRM — usuário já pesquisa alternativa específica. Bloquear em campanha evita cliques de usuários comprometidos com outras plataformas." },

  { pattern: /\b(download|baixar|instalar|app gratuito|aplicativo gratuito|software gratuito|programa gratuito)\b/i,
    level: "campaign",
    reason: "Intenção de download/instalação gratuita — usuário busca software sem custo. Bloquear em campanha evita cliques de usuários que não têm intenção de contratar serviço pago." },

  // Termos de app pessoal/mobile de reconhecimento facial (não B2B) — nível grupo
  { pattern: /\b(app de reconhecimento facial|reconhecimento facial app|reconhecimento facial celular|reconhecimento facial gratis|reconhecimento facial para celular)\b/i,
    level: "ad_group",
    reason: "App pessoal de reconhecimento facial — usuário busca app mobile para uso pessoal, não sistema empresarial. Manter no nível de grupo 'Acesso Controle' pois não deve bloquear buscas legítimas de outros grupos." },

  // Termos de segurança genérica (pode ser relevante para alguns grupos) — nível grupo
  { pattern: /^(segurança|seguranca|segurança condominios|seguranca condominios|segurança predial|seguranca predial)$/i,
    level: "ad_group",
    reason: "Termo de segurança genérico — pode ser relevante para grupos de controle de acesso mas não para outros produtos. Manter no nível de grupo para controle granular." },

  // WhatsApp Business (produto do Meta, não concorrente direto mas intenção diferente) — nível grupo
  { pattern: /\b(whatsapp business|whatsapp bus\b|whatsapp comercial|whatsapp business desktop|whatsapp business for|whatsapp business pc|whatsapp business mac)\b/i,
    level: "ad_group",
    reason: "WhatsApp Business — usuário busca o produto nativo do Meta, não solução de multiatendimento. Manter no grupo 'WhatsApp' para não bloquear buscas de outros grupos." },

  // Chatbots pessoais e IAs de conversa (não B2B) — nível grupo WhatsApp
  { pattern: /\b(chat bot app|chat ia|chatbot|conversa com ia|conversa ia|ia responde|freedomgpt|ask blackbox|tidio chatbot|zapia ia|grupo de ia whatsapp)\b/i,
    level: "ad_group",
    reason: "Chatbot/IA pessoal de conversa — usuário busca ferramenta pessoal de chat com IA, não solução B2B de multiatendimento. Manter no grupo 'WhatsApp' para não bloquear outros grupos." },

  // Intenção de configurar WhatsApp pessoal — nível grupo WhatsApp
  { pattern: /\b(como colocar mensagem autom[aá]tica no zap|como colocar preenchimento autom[aá]tico no whatsapp|como usar intelig[eê]ncia artificial do whatsapp|melhor app para mensagem automatica|programar mensagem whatsapp)\b/i,
    level: "ad_group",
    reason: "Intenção de configurar WhatsApp pessoal — usuário quer configurar o próprio WhatsApp, não contratar plataforma B2B. Manter no grupo 'WhatsApp' para não afetar outros grupos." },

  // ── NÍVEL GRUPO: termos específicos por produto ───────────────────────────

  { pattern: /\b(servidor|server|nuvem|cloud|aws|azure|google cloud|docker|kubernetes|devops|programa[cç][aã]o|desenvolvimento de software|api|sdk|github|gitlab)\b/i,
    level: "ad_group",
    reason: "Termo técnico de TI genérico — pode ser relevante para grupos de automação/IA mas não para hardware (Wallbox, catraca). Aplicar no nível de grupo permite controle granular por produto." },

  { pattern: /\b(instalar sozinho|instalar eu mesmo|como instalar|instala[cç][aã]o pr[oó]pria|diy|fa[cç]a voc[eê] mesmo|sem t[eé]cnico)\b/i,
    level: "ad_group",
    reason: "Intenção de auto-instalação — pode ser relevante para grupos de software (ZIPY, ConciergIA) mas não para hardware que exige instalação técnica (Wallbox, catraca). Nível grupo permite distinção." },
];

function classifyNegative(text) {
  const lower = text.toLowerCase().trim();
  for (const rule of RULES) {
    if (rule.pattern.test(lower)) {
      return { recommendedLevel: rule.level, reason: rule.reason };
    }
  }
  return { recommendedLevel: null, reason: "Termo específico sem padrão de reclassificação identificado — manter no nível atual." };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`AUDITORIA COMPLETA DE PALAVRAS NEGATIVAS — ${DRY_RUN ? "DRY-RUN" : "LIVE"}`);
  console.log(`${"=".repeat(70)}\n`);

  // 1. Buscar negativas de campanha
  console.log("📥 Buscando negativas de campanha...");
  const campNegRows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign_criterion.criterion_id,
      campaign_criterion.keyword.text,
      campaign_criterion.keyword.match_type,
      campaign_criterion.negative,
      campaign_criterion.resource_name
    FROM campaign_criterion
    WHERE campaign_criterion.negative = TRUE
      AND campaign_criterion.type = KEYWORD
      AND campaign.status != 'REMOVED'
    ORDER BY campaign.name, campaign_criterion.keyword.text
    LIMIT 1000
  `);

  // 2. Buscar negativas de grupo
  console.log("📥 Buscando negativas de grupo de anúncio...");
  const groupNegRows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group.status,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.negative,
      ad_group_criterion.resource_name
    FROM ad_group_criterion
    WHERE ad_group_criterion.negative = TRUE
      AND ad_group_criterion.type = KEYWORD
      AND campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
    ORDER BY campaign.name, ad_group.name, ad_group_criterion.keyword.text
    LIMIT 1000
  `);

  // 3. Buscar grupos de anúncios ativos
  console.log("📥 Buscando grupos de anúncios ativos...");
  const adGroupRows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group.status,
      ad_group.resource_name
    FROM ad_group
    WHERE ad_group.status = 'ENABLED'
      AND campaign.status != 'REMOVED'
    ORDER BY campaign.name, ad_group.name
    LIMIT 200
  `);

  // ─── Normalizar dados ──────────────────────────────────────────────────────
  const matchTypeMap = { 2: "EXACT", 3: "BROAD", 4: "PHRASE", EXACT: "EXACT", BROAD: "BROAD", PHRASE: "PHRASE" };

  const campNegatives = campNegRows.map(r => ({
    level: "campaign",
    campaignId: String(r.campaign?.id ?? ""),
    campaignName: String(r.campaign?.name ?? ""),
    criterionId: String(r.campaign_criterion?.criterion_id ?? ""),
    text: String(r.campaign_criterion?.keyword?.text ?? "").toLowerCase().trim(),
    matchType: matchTypeMap[r.campaign_criterion?.keyword?.match_type] ?? "BROAD",
    resourceName: String(r.campaign_criterion?.resource_name ?? ""),
  })).filter(n => n.text);

  const groupNegatives = groupNegRows.map(r => ({
    level: "ad_group",
    campaignId: String(r.campaign?.id ?? ""),
    campaignName: String(r.campaign?.name ?? ""),
    adGroupId: String(r.ad_group?.id ?? ""),
    adGroupName: String(r.ad_group?.name ?? ""),
    criterionId: String(r.ad_group_criterion?.criterion_id ?? ""),
    text: String(r.ad_group_criterion?.keyword?.text ?? "").toLowerCase().trim(),
    matchType: matchTypeMap[r.ad_group_criterion?.keyword?.match_type] ?? "BROAD",
    resourceName: String(r.ad_group_criterion?.resource_name ?? ""),
  })).filter(n => n.text);

  const adGroups = adGroupRows.map(r => ({
    campaignId: String(r.campaign?.id ?? ""),
    campaignName: String(r.campaign?.name ?? ""),
    adGroupId: String(r.ad_group?.id ?? ""),
    adGroupName: String(r.ad_group?.name ?? ""),
    resourceName: String(r.ad_group?.resource_name ?? ""),
  }));

  console.log(`\n📊 Estado atual:`);
  console.log(`   Negativas de campanha: ${campNegatives.length}`);
  console.log(`   Negativas de grupo: ${groupNegatives.length}`);
  console.log(`   Grupos de anúncios ativos: ${adGroups.length}`);

  // ─── Detectar duplicatas dentro do mesmo nível ─────────────────────────────
  const campDuplicates = [];
  const campSeen = new Map();
  for (const n of campNegatives) {
    const key = `${n.campaignId}|${n.text}|${n.matchType}`;
    if (campSeen.has(key)) {
      campDuplicates.push({ ...n, reason: "Duplicata exata no nível de campanha — remover para manter lista limpa." });
    } else {
      campSeen.set(key, n);
    }
  }

  const groupDuplicates = [];
  const groupSeen = new Map();
  for (const n of groupNegatives) {
    const key = `${n.adGroupId}|${n.text}|${n.matchType}`;
    if (groupSeen.has(key)) {
      groupDuplicates.push({ ...n, reason: "Duplicata exata no mesmo grupo de anúncio — remover para evitar conflito." });
    } else {
      groupSeen.set(key, n);
    }
  }

  // ─── Detectar redundâncias (grupo = campanha) ──────────────────────────────
  const redundantGroupNegs = [];
  const nonRedundantGroupNegs = [];
  for (const n of groupNegatives) {
    if (groupDuplicates.some(d => d.resourceName === n.resourceName)) continue; // já marcado como duplicata
    const key = `${n.campaignId}|${n.text}|${n.matchType}`;
    if (campSeen.has(key)) {
      redundantGroupNegs.push({ ...n, reason: `Redundante — o mesmo termo "${n.text}" [${n.matchType}] já existe no nível de campanha "${n.campaignName}". Manter apenas na campanha é mais eficiente.` });
    } else {
      nonRedundantGroupNegs.push(n);
    }
  }

  // ─── Classificar negativas de grupo não redundantes ────────────────────────
  const toPromoteToCampaign = []; // grupo → campanha
  const toKeepInGroup = [];       // manter no grupo

  for (const n of nonRedundantGroupNegs) {
    const { recommendedLevel, reason } = classifyNegative(n.text);
    if (recommendedLevel === "campaign") {
      // Verificar se já existe na campanha (pode ter sido adicionada recentemente)
      const alreadyInCampaign = campNegatives.some(
        c => c.campaignId === n.campaignId && c.text === n.text && c.matchType === n.matchType
      );
      if (!alreadyInCampaign) {
        toPromoteToCampaign.push({ ...n, reason: `PROMOVER para campanha: ${reason}` });
      } else {
        redundantGroupNegs.push({ ...n, reason: `Redundante após análise — já existe na campanha. ${reason}` });
      }
    } else {
      toKeepInGroup.push({ ...n, reason });
    }
  }

  // ─── Classificar negativas de campanha ────────────────────────────────────
  const campAnalyzed = campNegatives
    .filter(n => !campDuplicates.some(d => d.resourceName === n.resourceName))
    .map(n => {
      const { recommendedLevel, reason } = classifyNegative(n.text);
      return { ...n, recommendedLevel, reason };
    });

  const campCorrect = campAnalyzed.filter(n => n.recommendedLevel === "campaign" || n.recommendedLevel === null);
  const campToDowngrade = campAnalyzed.filter(n => n.recommendedLevel === "ad_group");

  // ─── Relatório ─────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(70)}`);
  console.log(`ANÁLISE COMPLETA`);
  console.log(`${"─".repeat(70)}`);

  console.log(`\n🔴 Duplicatas a remover:`);
  console.log(`   Campanha: ${campDuplicates.length} | Grupo: ${groupDuplicates.length}`);
  if (campDuplicates.length > 0) {
    campDuplicates.slice(0, 5).forEach(n => console.log(`   CAMP-DUP: "${n.text}" [${n.matchType}] em "${n.campaignName}"`));
  }

  console.log(`\n🔴 Redundâncias grupo→campanha a remover: ${redundantGroupNegs.length}`);
  redundantGroupNegs.slice(0, 8).forEach(n =>
    console.log(`   REDUNDANTE: "${n.text}" [${n.matchType}] em grupo "${n.adGroupName}" (já na campanha)`));

  console.log(`\n⬆️  Negativas de grupo a PROMOVER para campanha: ${toPromoteToCampaign.length}`);
  toPromoteToCampaign.slice(0, 10).forEach(n =>
    console.log(`   PROMOVER: "${n.text}" [${n.matchType}] | ${n.reason.substring(0, 70)}...`));

  console.log(`\n✅ Negativas de grupo a MANTER: ${toKeepInGroup.length}`);
  toKeepInGroup.slice(0, 5).forEach(n =>
    console.log(`   MANTER: "${n.text}" [${n.matchType}] em "${n.adGroupName}"`));

  console.log(`\n✅ Negativas de campanha CORRETAS: ${campCorrect.length}`);
  if (campToDowngrade.length > 0) {
    console.log(`\n⬇️  Negativas de campanha a REBAIXAR para grupo: ${campToDowngrade.length}`);
    campToDowngrade.forEach(n => console.log(`   REBAIXAR: "${n.text}" | ${n.reason.substring(0, 70)}...`));
  }

  // ─── Salvar relatório JSON ─────────────────────────────────────────────────
  const report = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? "DRY_RUN" : "LIVE",
    summary: {
      totalCampaignNegatives: campNegatives.length,
      totalGroupNegatives: groupNegatives.length,
      totalAdGroups: adGroups.length,
      campDuplicates: campDuplicates.length,
      groupDuplicates: groupDuplicates.length,
      redundantGroupNegs: redundantGroupNegs.length,
      toPromoteToCampaign: toPromoteToCampaign.length,
      toKeepInGroup: toKeepInGroup.length,
      campCorrect: campCorrect.length,
      campToDowngrade: campToDowngrade.length,
      totalToRemove: campDuplicates.length + groupDuplicates.length + redundantGroupNegs.length,
      totalToAdd: toPromoteToCampaign.length,
    },
    details: {
      campDuplicates,
      groupDuplicates,
      redundantGroupNegs,
      toPromoteToCampaign,
      toKeepInGroup,
      campCorrect,
      campToDowngrade,
    },
    allCampaignNegatives: campNegatives,
    allGroupNegatives: groupNegatives,
    adGroups,
  };

  writeFileSync("/tmp/negatives-audit.json", JSON.stringify(report, null, 2));
  console.log(`\n💾 Relatório completo salvo em /tmp/negatives-audit.json`);

  console.log(`\n${"─".repeat(70)}`);
  console.log(`RESUMO DO PLANO DE AÇÃO:`);
  console.log(`  Remover ${report.summary.totalToRemove} negativas (duplicatas + redundâncias)`);
  console.log(`  Promover ${report.summary.totalToAdd} negativas de grupo → campanha`);
  console.log(`  Manter ${report.summary.toKeepInGroup} negativas de grupo (corretas)`);
  console.log(`  Manter ${report.summary.campCorrect} negativas de campanha (corretas)`);
  console.log(`${"─".repeat(70)}`);

  if (DRY_RUN) {
    console.log(`\n✅ DRY-RUN concluído. Execute com --live para aplicar as mudanças.\n`);
    return report;
  }

  // ─── LIVE: Executar mudanças ───────────────────────────────────────────────
  console.log(`\n${"=".repeat(70)}`);
  console.log(`EXECUTANDO MUDANÇAS (LIVE)`);
  console.log(`${"=".repeat(70)}\n`);

  const results = { removed: [], added: [], errors: [] };

  // 1. Remover duplicatas de campanha
  if (campDuplicates.length > 0) {
    console.log(`\n🗑️  Removendo ${campDuplicates.length} duplicatas de campanha...`);
    for (const n of campDuplicates) {
      try {
        await customer.campaignCriteria.remove([n.resourceName]);
        results.removed.push(`[CAMP-DUP] "${n.text}" [${n.matchType}] da campanha "${n.campaignName}"`);
        await sleep(150);
      } catch (e) {
        const msg = e?.errors?.[0]?.message ?? e?.message ?? String(e);
        results.errors.push(`[CAMP-DUP] Erro removendo "${n.text}": ${msg}`);
      }
    }
  }

  // 2. Remover duplicatas de grupo
  if (groupDuplicates.length > 0) {
    console.log(`\n🗑️  Removendo ${groupDuplicates.length} duplicatas de grupo...`);
    for (const n of groupDuplicates) {
      try {
        await customer.adGroupCriteria.remove([n.resourceName]);
        results.removed.push(`[GROUP-DUP] "${n.text}" [${n.matchType}] do grupo "${n.adGroupName}"`);
        await sleep(150);
      } catch (e) {
        const msg = e?.errors?.[0]?.message ?? e?.message ?? String(e);
        results.errors.push(`[GROUP-DUP] Erro removendo "${n.text}": ${msg}`);
      }
    }
  }

  // 3. Remover redundâncias (grupo = campanha)
  if (redundantGroupNegs.length > 0) {
    console.log(`\n🗑️  Removendo ${redundantGroupNegs.length} negativas redundantes de grupo...`);
    for (const n of redundantGroupNegs) {
      try {
        await customer.adGroupCriteria.remove([n.resourceName]);
        results.removed.push(`[REDUNDANTE] "${n.text}" [${n.matchType}] do grupo "${n.adGroupName}" — já existe na campanha`);
        await sleep(150);
      } catch (e) {
        const msg = e?.errors?.[0]?.message ?? e?.message ?? String(e);
        results.errors.push(`[REDUNDANTE] Erro removendo "${n.text}" de "${n.adGroupName}": ${msg}`);
      }
    }
  }

  // 4. Promover negativas de grupo para campanha
  if (toPromoteToCampaign.length > 0) {
    console.log(`\n⬆️  Promovendo ${toPromoteToCampaign.length} negativas para nível de campanha...`);
    // Agrupar por campanha
    const byCampaign = {};
    for (const n of toPromoteToCampaign) {
      if (!byCampaign[n.campaignId]) byCampaign[n.campaignId] = [];
      byCampaign[n.campaignId].push(n);
    }

    for (const [campaignId, negatives] of Object.entries(byCampaign)) {
      const campaignRn = `customers/${CUSTOMER_ID}/campaigns/${campaignId}`;
      for (const n of negatives) {
        try {
          await customer.campaignCriteria.create([{
            campaign: campaignRn,
            negative: true,
            type: "KEYWORD",
            keyword: { text: n.text, match_type: n.matchType },
          }]);
          results.added.push(`[PROMOVIDO→CAMP] "${n.text}" [${n.matchType}] → campanha "${n.campaignName}" | Motivo: ${n.reason}`);
          await sleep(200);
          // Remover do grupo (agora redundante)
          try {
            await customer.adGroupCriteria.remove([n.resourceName]);
            results.removed.push(`[REMOVIDO-GRUPO] "${n.text}" do grupo "${n.adGroupName}" (promovido para campanha)`);
            await sleep(150);
          } catch (e2) {
            const msg = e2?.errors?.[0]?.message ?? e2?.message ?? String(e2);
            results.errors.push(`[REMOVE-GROUP] Erro removendo "${n.text}" de "${n.adGroupName}" após promoção: ${msg}`);
          }
        } catch (e) {
          const msg = e?.errors?.[0]?.message ?? e?.message ?? String(e);
          results.errors.push(`[PROMOVER] Erro adicionando "${n.text}" na campanha "${n.campaignName}": ${msg}`);
        }
      }
    }
  }

  // ─── Resultado final ───────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(70)}`);
  console.log(`RESULTADO FINAL`);
  console.log(`${"=".repeat(70)}`);
  console.log(`✅ Removidos: ${results.removed.length}`);
  console.log(`✅ Adicionados/Promovidos: ${results.added.length}`);
  console.log(`❌ Erros: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log(`\nErros encontrados:`);
    results.errors.forEach(e => console.log(`  ❌ ${e}`));
  }

  console.log(`\nAções realizadas:`);
  results.removed.slice(0, 20).forEach(r => console.log(`  🗑️  ${r}`));
  results.added.slice(0, 20).forEach(a => console.log(`  ✅ ${a}`));

  const finalReport = { ...report, results };
  writeFileSync("/tmp/negatives-audit-result.json", JSON.stringify(finalReport, null, 2));
  console.log(`\n💾 Resultado completo salvo em /tmp/negatives-audit-result.json\n`);

  return finalReport;
}

main().catch(err => {
  console.error("ERRO CRÍTICO:", err?.errors?.[0]?.message ?? err?.message ?? err);
  process.exit(1);
});
