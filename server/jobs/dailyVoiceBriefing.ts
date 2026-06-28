/**
 * Job Diário — Briefing de Voz
 * Todo dia às 7h45 (America/Sao_Paulo)
 * Gera texto via LLM e tenta síntese via VoxForge (se disponível)
 */
import cron from "node-cron";
import { getDb } from "../db";
import { voiceBriefings } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";

const JOB_NAME = "DailyVoiceBriefing";

async function generateBriefingText(data: {
  date: string;
  alertsCount: number;
  topAlert: string;
  ctr: string;
  cpc: string;
  conversions: number;
}): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Você é o assistente executivo de marketing da Zênite Tech. Gere briefings diários concisos e profissionais em português brasileiro.",
        },
        {
          role: "user",
          content: `Gere um briefing executivo de 60 segundos (máximo 150 palavras) para o dia ${data.date}.

Dados do dia:
- Alertas ativos: ${data.alertsCount}
- Principal alerta: ${data.topAlert}
- CTR médio das campanhas: ${data.ctr}%
- CPC médio: R$${data.cpc}
- Conversões do dia: ${data.conversions}

Comece com "Bom dia, Ricardo." e termine com a ação mais urgente do dia.
Tom: profissional, direto, objetivo. Não use bullet points — texto corrido.`,
        },
      ],
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) return `Bom dia, Ricardo. Sem dados disponíveis para o briefing de hoje, ${data.date}.`;
    return typeof rawContent === "string" ? rawContent : (rawContent as any[]).map((c: any) => c.text ?? "").join("");
  } catch {
    return `Bom dia, Ricardo. Briefing de ${data.date}: ${data.alertsCount} alertas ativos. CTR médio ${data.ctr}%, CPC R$${data.cpc}. Verifique o dashboard para detalhes.`;
  }
}

async function tryVoxForge(text: string, voxforgeUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${voxforgeUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: "pt-BR-Ricardo", language: "pt" }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return null;

    // Se retornar URL de áudio
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await response.json();
      return json.url ?? json.audio_url ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

export async function runDailyVoiceBriefing(): Promise<void> {
  console.log(`[${JOB_NAME}] Iniciando geração de briefing diário...`);

  const db = await getDb();
  if (!db) {
    console.warn(`[${JOB_NAME}] Banco de dados não disponível`);
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    // Dados simplificados — em produção, buscar dados reais das APIs
    const briefingData = {
      date: today,
      alertsCount: 0,
      topAlert: "Nenhum alerta crítico no momento",
      ctr: "10.82",
      cpc: "2.77",
      conversions: 0,
    };

    // Gerar texto via LLM
    const text = await generateBriefingText(briefingData);
    console.log(`[${JOB_NAME}] Texto gerado: ${text.length} caracteres`);

    // Tentar síntese via VoxForge (opcional)
    const voxforgeUrl = process.env.VOXFORGE_URL ?? "";
    let audioUrl: string | null = null;

    if (voxforgeUrl) {
      audioUrl = await tryVoxForge(text, voxforgeUrl);
      if (audioUrl) {
        console.log(`[${JOB_NAME}] Áudio gerado via VoxForge: ${audioUrl}`);
      } else {
        console.warn(`[${JOB_NAME}] VoxForge não disponível — salvando apenas o texto`);
      }
    } else {
      console.log(`[${JOB_NAME}] VOXFORGE_URL não configurado — modo texto apenas`);
    }

    // Salvar no banco
    await db.insert(voiceBriefings).values({
      date: today,
      text,
      audioUrl: audioUrl ?? null,
      duration: Math.ceil(text.split(" ").length / 2.5), // estimativa: ~2.5 palavras/segundo
    });

    console.log(`[${JOB_NAME}] Briefing salvo para ${today}`);
  } catch (err) {
    console.error(`[${JOB_NAME}] Erro durante execução:`, err);
  }
}

// Agendamento: todo dia às 7h45 (America/Sao_Paulo)
export function scheduleDailyVoiceBriefing(): void {
  const CRON_EXPRESSION = "0 45 7 * * *"; // 7h45 todos os dias
  const timezone = "America/Sao_Paulo";

  
  cron.schedule(
    CRON_EXPRESSION,
    async () => {
      console.log(`[${JOB_NAME}] Disparando job diário...`);
      await runDailyVoiceBriefing();
    },
    { timezone }
  );

  console.log(`[${JOB_NAME}] Job diário agendado: todo dia às 7h45 (${timezone})`);
}

// Auto-inicializar ao importar
scheduleDailyVoiceBriefing();
