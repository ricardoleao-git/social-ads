/**
 * Job: Verificação Diária de Pausa Automática
 * Roda todo dia às 9h (America/Sao_Paulo)
 * Detecta grupos de anúncios com CTR < 2% nos últimos 7 dias
 * e cria propostas de pausa para revisão humana.
 */
import cron from "node-cron";
import { getDb } from "../db";
import { autoPauseProposals, alertHistory } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

const CTR_THRESHOLD = 0.02; // 2%
const MIN_SPEND = 20; // R$ 20 mínimo para considerar
const LOOKBACK_DAYS = 7;

export async function runDailyAutoPauseCheck() {
  console.log("[AutoPauseCheck] Iniciando verificação de grupos com baixo CTR...");

  // ── Verificar tokens próximos do vencimento (alerta proativo 30 dias antes)
  try {
    const { getTokenAlerts } = await import("../credentials");
    const tokenAlerts = getTokenAlerts();
    if (tokenAlerts.length > 0) {
      for (const alert of tokenAlerts) {
        const label = alert.token === "googleAds" ? "Google Ads" : alert.token === "gmail" ? "Gmail" : alert.token;
        await notifyOwner({
          title: `⚠️ Token ${label} vence em ${alert.daysLeft} dias`,
          content: `O Refresh Token do ${label} vence em ${alert.expiresAt} (${alert.daysLeft} dias restantes). Renove via OAuth Playground antes que expire para evitar interrupção do dashboard.`,
        });
        console.log(`[AutoPauseCheck] Alerta de vencimento enviado: ${label} vence em ${alert.daysLeft} dias.`);
      }
    }
  } catch (tokenErr: any) {
    console.error("[AutoPauseCheck] Erro ao verificar expiração de tokens:", tokenErr?.message);
  }

  try {
    // Buscar dados do Google Ads via API interna
    const { ENV } = await import("../_core/env");
    const customerId = ENV.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, "");
    const developerToken = ENV.GOOGLE_ADS_DEVELOPER_TOKEN;
    const refreshToken = ENV.GOOGLE_ADS_REFRESH_TOKEN;
    const clientId = ENV.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = ENV.GOOGLE_ADS_CLIENT_SECRET;
    const loginCustomerId = ENV.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, "");

    if (!customerId || !developerToken || !refreshToken) {
      console.log("[AutoPauseCheck] Credenciais Google Ads ausentes — pulando.");
      return;
    }

    // Obter access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId || "",
        client_secret: clientSecret || "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) {
      console.log("[AutoPauseCheck] Falha ao obter access token.");
      // Criar alerta de token expirado
      await createTokenExpiryAlert();
      return;
    }

    // Calcular datas
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // ontem
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - LOOKBACK_DAYS + 1);
    const fmt = (d: Date) => d.toISOString().split("T")[0].replace(/-/g, "");
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    // Query GAQL para grupos de anúncios
    const query = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        metrics.clicks,
        metrics.impressions,
        metrics.cost_micros,
        metrics.ctr
      FROM ad_group
      WHERE segments.date BETWEEN '${startStr}' AND '${endStr}'
        AND ad_group.status = 'ENABLED'
        AND campaign.status = 'ENABLED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 50
    `;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokenData.access_token}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
    };
    if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

    const adsRes = await fetch(
      `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ query }),
      }
    );
    const adsData = await adsRes.json() as any;

    if (!adsData.results || adsData.results.length === 0) {
      console.log("[AutoPauseCheck] Nenhum dado retornado da API.");
      return;
    }

    const db = await getDb();
    if (!db) {
      console.log("[AutoPauseCheck] DB indisponível.");
      return;
    }

    let proposalsCreated = 0;

    for (const row of adsData.results) {
      const adGroupId = row.adGroup?.id?.toString() || "";
      const adGroupName = row.adGroup?.name || "Grupo desconhecido";
      const ctr = row.metrics?.ctr || 0;
      const costMicros = row.metrics?.costMicros || 0;
      const totalSpend = costMicros / 1_000_000;
      const impressions = row.metrics?.impressions || 0;

      // Critérios: CTR < 2%, gasto mínimo R$20, pelo menos 100 impressões
      if (ctr < CTR_THRESHOLD && totalSpend >= MIN_SPEND && impressions >= 100) {
        // Verificar se já existe proposta pendente para este grupo
        const existing = await db
          .select({ id: autoPauseProposals.id })
          .from(autoPauseProposals)
          .where(eq(autoPauseProposals.adGroupId, adGroupId))
          .limit(1);

        const hasPending = existing.length > 0;

        if (!hasPending) {
          await db.insert(autoPauseProposals).values({
            adGroupId,
            adGroupName,
            avgCtr: (ctr * 100).toFixed(4),
            totalSpend: totalSpend.toFixed(2),
            status: "pending",
          });
          proposalsCreated++;
          console.log(`[AutoPauseCheck] Proposta criada: "${adGroupName}" CTR=${(ctr * 100).toFixed(2)}% Gasto=R$${totalSpend.toFixed(2)}`);
        }
      }
    }

    if (proposalsCreated > 0) {
      // Criar alerta no histórico
      await db.insert(alertHistory).values({
        type: "auto_pause_check",
        severity: "warning",
        title: `${proposalsCreated} grupo(s) com CTR baixo detectado(s)`,
        message: `Job diário detectou ${proposalsCreated} grupo(s) com CTR < 2% nos últimos ${LOOKBACK_DAYS} dias. Acesse Automações → Pausa Automática para revisar.`,
        metadata: JSON.stringify({ proposalsCreated, threshold: CTR_THRESHOLD * 100, lookbackDays: LOOKBACK_DAYS }),
      });
      // B5: Notificação push imediata para o owner
      await notifyOwner({
        title: `⚠️ ${proposalsCreated} grupo(s) com CTR baixo detectado(s)`,
        content: `Job diário detectou ${proposalsCreated} grupo(s) com CTR < ${CTR_THRESHOLD * 100}% nos últimos ${LOOKBACK_DAYS} dias. Acesse Automações → Pausa Automática para revisar e aprovar.`,
      });
    }

    console.log(`[AutoPauseCheck] Concluído. ${proposalsCreated} proposta(s) criada(s).`);
  } catch (err: any) {
    console.error("[AutoPauseCheck] Erro:", err?.message || err);
  }
}

/**
 * Cria alerta de token OAuth expirando/expirado.
 */
export async function createTokenExpiryAlert() {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(alertHistory).values({
      type: "token_expiry",
      severity: "critical",
      title: "Token OAuth Google Ads expirado ou inválido",
      message: "O refresh token do Google Ads falhou ao renovar o access token. Acesse Configurações → Credenciais para renovar o token OAuth.",
      metadata: JSON.stringify({ detectedAt: new Date().toISOString() }),
    });
    console.log("[AutoPauseCheck] Alerta de token expirado criado.");
  } catch (err: any) {
    console.error("[AutoPauseCheck] Erro ao criar alerta de token:", err?.message);
  }
}

// Agendar: todo dia às 9h (horário de Brasília)
cron.schedule(
  "0 9 * * *",
  () => {
    runDailyAutoPauseCheck();
  },
  {
    timezone: "America/Sao_Paulo",
  }
);
console.log("[AutoPauseCheck] Job diário agendado: todo dia às 9h (America/Sao_Paulo)");
