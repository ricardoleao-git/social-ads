/**
 * Job: Calendário Editorial de Anúncios Sazonais (C2)
 * Roda todo dia às 8h (America/Sao_Paulo)
 *
 * Verifica se há datas relevantes nos próximos 7 dias e gera alertas
 * com sugestões de copy e ajuste de lances para cada data.
 */
import cron from "node-cron";
import { getDb } from "../db";
import { alertHistory } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";

interface SeasonalDate {
  name: string;
  month: number; // 1-12
  day: number;
  segment: string; // público-alvo principal
  suggestion: string; // sugestão de copy/estratégia
  bidBoost: number; // % de aumento de lance sugerido
}

const SEASONAL_DATES: SeasonalDate[] = [
  // Datas relevantes para o segmento B2B da Zênite Tech
  { name: "Dia do Trabalho", month: 5, day: 1, segment: "Empresas", suggestion: "Destaque automação e produtividade. Copy: 'Automatize o controle de acesso da sua empresa'", bidBoost: 20 },
  { name: "Dia do Síndico", month: 3, day: 15, segment: "Condomínios", suggestion: "Foco em GuardIA e Catraca. Copy: 'Segurança inteligente para seu condomínio'", bidBoost: 30 },
  { name: "Semana da Segurança no Trabalho", month: 4, day: 28, segment: "Empresas", suggestion: "Destaque controle de acesso e monitoramento. Aumentar lances em grupos Zface e Zblock", bidBoost: 25 },
  { name: "Dia do Professor", month: 10, day: 15, segment: "Escolas", suggestion: "Foco em GuardIA para escolas. Copy: 'Proteja sua escola com reconhecimento facial'", bidBoost: 35 },
  { name: "Volta às Aulas (Jan)", month: 1, day: 25, segment: "Escolas", suggestion: "Campanha de segurança escolar. Aumentar orçamento em grupos GuardIA Escolas", bidBoost: 40 },
  { name: "Volta às Aulas (Jul)", month: 7, day: 20, segment: "Escolas", suggestion: "Segunda janela de volta às aulas. Reativar grupos de escolas pausados", bidBoost: 35 },
  { name: "Semana do Meio Ambiente", month: 6, day: 5, segment: "Mobilidade Elétrica", suggestion: "Foco em Wallbox e recarga elétrica. Copy: 'Carregue seu veículo com energia limpa'", bidBoost: 30 },
  { name: "Black Friday", month: 11, day: 28, segment: "Todos", suggestion: "Aumentar orçamento em todos os grupos. Copy com urgência e desconto", bidBoost: 50 },
  { name: "Natal / Fim de Ano", month: 12, day: 15, segment: "Empresas", suggestion: "Decisões de investimento de fim de ano. Copy: 'Invista em segurança antes do recesso'", bidBoost: 25 },
  { name: "Dia das Mães", month: 5, day: 11, segment: "Condomínios", suggestion: "Foco em segurança residencial. Copy: 'O melhor presente é segurança para sua família'", bidBoost: 15 },
  { name: "Dia dos Pais", month: 8, day: 10, segment: "Condomínios", suggestion: "Segurança residencial e controle de acesso. Aumentar lances em grupos residenciais", bidBoost: 15 },
  { name: "Semana da Tecnologia", month: 10, day: 1, segment: "Empresas", suggestion: "Destaque IA e automação. Copy: 'Transforme sua empresa com inteligência artificial'", bidBoost: 20 },
  { name: "Ano Novo", month: 1, day: 2, segment: "Empresas", suggestion: "Planejamento de início de ano. Copy: 'Comece 2025 com segurança e automação'", bidBoost: 20 },
  { name: "Carnaval (pré)", month: 2, day: 14, segment: "Condomínios", suggestion: "Segurança em período de festas. Copy: 'Controle quem entra no seu condomínio'", bidBoost: 25 },
  { name: "Dia do Cliente", month: 9, day: 15, segment: "Todos", suggestion: "Campanha de relacionamento. Foco em retenção e upsell para clientes existentes", bidBoost: 10 },
];

function getDaysUntil(month: number, day: number): number {
  const now = new Date();
  const thisYear = now.getFullYear();
  let target = new Date(thisYear, month - 1, day);
  if (target < now) {
    target = new Date(thisYear + 1, month - 1, day);
  }
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export async function runSeasonalCalendarCheck() {
  console.log("[SeasonalCalendar] Verificando datas sazonais...");
  try {
    const db = await getDb();
    if (!db) return;

    const upcomingDates = SEASONAL_DATES.filter(d => {
      const days = getDaysUntil(d.month, d.day);
      return days >= 0 && days <= 7;
    });

    if (upcomingDates.length === 0) {
      console.log("[SeasonalCalendar] Nenhuma data relevante nos próximos 7 dias.");
      return;
    }

    for (const date of upcomingDates) {
      const daysUntil = getDaysUntil(date.month, date.day);
      const severity = daysUntil <= 2 ? "warning" : "info";
      const msg = `📅 ${date.name} em ${daysUntil} dia(s)\n\nSegmento: ${date.segment}\nSugestão: ${date.suggestion}\nAjuste de lance sugerido: +${date.bidBoost}%`;

      await db.insert(alertHistory).values({
        type: "seasonal_calendar",
        severity,
        title: `📅 ${date.name} em ${daysUntil} dia(s) — Oportunidade de campanha`,
        message: msg,
        metadata: JSON.stringify({ date, daysUntil }),
      });
    }

    if (upcomingDates.length > 0) {
      await notifyOwner({
        title: `📅 ${upcomingDates.length} data(s) sazonal(is) nos próximos 7 dias`,
        content: upcomingDates.map(d => `${d.name} (${getDaysUntil(d.month, d.day)}d) — ${d.segment}`).join("\n"),
      });
    }

    console.log(`[SeasonalCalendar] ${upcomingDates.length} alerta(s) gerado(s).`);
  } catch (err: any) {
    console.error("[SeasonalCalendar] Erro:", err?.message || err);
  }
}

// Todo dia às 8h (America/Sao_Paulo)
cron.schedule(
  "0 0 8 * * *",
  () => { runSeasonalCalendarCheck(); },
  { timezone: "America/Sao_Paulo" }
);
console.log("[SeasonalCalendar] Job agendado: todo dia às 8h (America/Sao_Paulo)");
