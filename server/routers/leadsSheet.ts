import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { google } from "googleapis";

const SPREADSHEET_ID = "1xlYXBfgab0BzkjELK6Rx-fuUL3kNqlqV93tZns9sIsw";

async function getSheetsClient() {
  const serviceAccountJson = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error("GA4_SERVICE_ACCOUNT_JSON não configurado");

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

export const leadsSheetRouter = router({
  // Buscar todos os leads da planilha
  getLeads: protectedProcedure
    .input(z.object({
      campaign: z.string().optional(),
      adGroup: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
    }))
    .query(async ({ input }) => {
      try {
        const sheets = await getSheetsClient();
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Leads!A:H",
        });

        const rows = response.data.values || [];
        if (rows.length <= 1) return { leads: [], total: 0, sheetsUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}` };

        // Primeira linha é cabeçalho
        const headers = rows[0];
        const dataRows = rows.slice(1);

        const leads = dataRows.map((row) => ({
          data: row[0] || "",
          campanha: row[1] || "",
          grupo: row[2] || "",
          conversao: row[3] || "",
          quantidade: parseInt(row[4] || "0"),
          cpa: row[5] || "",
          dispositivo: row[6] || "",
          keyword: row[7] || "",
        }));

        // Filtros
        let filtered = leads;
        if (input.campaign) {
          filtered = filtered.filter(l => l.campanha.toLowerCase().includes(input.campaign!.toLowerCase()));
        }
        if (input.adGroup) {
          filtered = filtered.filter(l => l.grupo.toLowerCase().includes(input.adGroup!.toLowerCase()));
        }

        // Ordenar por data desc
        filtered.sort((a, b) => b.data.localeCompare(a.data));

        return {
          leads: filtered.slice(0, input.limit),
          total: filtered.length,
          headers,
          sheetsUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
        };
      } catch (error: any) {
        // Se planilha vazia ou sem acesso, retornar vazio
        return {
          leads: [],
          total: 0,
          headers: ["Data", "Campanha", "Grupo", "Conversão", "Qtd", "CPA", "Dispositivo", "Keyword"],
          sheetsUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
          error: error.message,
        };
      }
    }),

  // Resumo de KPIs dos leads
  getSummary: protectedProcedure.query(async () => {
    try {
      const sheets = await getSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Leads!A:H",
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return { totalLeads: 0, totalConversions: 0, campaigns: [], adGroups: [], avgCpa: "R$0,00" };

      const dataRows = rows.slice(1);
      const leads = dataRows.map((row) => ({
        data: row[0] || "",
        campanha: row[1] || "",
        grupo: row[2] || "",
        conversao: row[3] || "",
        quantidade: parseInt(row[4] || "0"),
        cpa: parseFloat((row[5] || "0").replace("R$", "").replace(",", ".")),
      }));

      const totalConversions = leads.reduce((sum, l) => sum + l.quantidade, 0);
      const avgCpa = leads.length > 0
        ? (leads.reduce((sum, l) => sum + l.cpa, 0) / leads.length).toFixed(2)
        : "0.00";

      const campaigns = leads.map(l => l.campanha).filter((v, i, a) => v && a.indexOf(v) === i);
      const adGroups = leads.map(l => l.grupo).filter((v, i, a) => v && a.indexOf(v) === i);

      // Últimos 7 dias
      const last7 = leads.filter(l => {
        const parts = l.data.split("/");
        if (parts.length !== 3) return false;
        const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 7;
      });

      return {
        totalLeads: leads.length,
        totalConversions,
        campaigns,
        adGroups,
        avgCpa: `R$${avgCpa}`,
        last7Days: last7.reduce((sum, l) => sum + l.quantidade, 0),
        sheetsUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
      };
    } catch (error: any) {
      return {
        totalLeads: 0,
        totalConversions: 0,
        campaigns: [],
        adGroups: [],
        avgCpa: "R$0,00",
        last7Days: 0,
        sheetsUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
        error: error.message,
      };
    }
  }),

  // Qualificação de leads com IA (Quente/Morno/Frio)
  qualifyLeads: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      try {
        const sheets = await getSheetsClient();
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Leads!A:H",
        });
        const rows = response.data.values || [];
        if (rows.length <= 1) return { leads: [], total: 0 };
        
        const dataRows = rows.slice(1).slice(0, input.limit);
        const leads = dataRows.map((row, idx) => ({
          id: idx + 1,
          data: row[0] || "",
          campanha: row[1] || "",
          grupo: row[2] || "",
          conversao: row[3] || "",
          quantidade: parseInt(row[4] || "0"),
          cpa: row[5] || "",
          dispositivo: row[6] || "",
          keyword: row[7] || "",
        }));

        // Classify each lead using heuristic rules (fast, no LLM needed)
        const classified = leads.map(lead => {
          let score = 0;
          let reasons: string[] = [];
          
          // Quantidade de conversões
          if (lead.quantidade >= 3) { score += 3; reasons.push("Alta quantidade de conversões"); }
          else if (lead.quantidade >= 2) { score += 2; reasons.push("Múltiplas conversões"); }
          else if (lead.quantidade >= 1) { score += 1; reasons.push("Pelo menos 1 conversão"); }
          
          // CPA baixo = melhor qualidade
          const cpaVal = parseFloat((lead.cpa || "0").replace("R$", "").replace(",", "."));
          if (cpaVal > 0 && cpaVal < 5) { score += 2; reasons.push("CPA muito baixo (< R$5)"); }
          else if (cpaVal > 0 && cpaVal < 15) { score += 1; reasons.push("CPA moderado"); }
          
          // Keyword relevance (B2B terms)
          const kw = (lead.keyword || "").toLowerCase();
          const hotTerms = ["empresa", "comercial", "corporativo", "condomínio", "escola", "indústria", "comprar", "orçamento", "preço", "contratar"];
          const coldTerms = ["como", "o que é", "grátis", "gratuito", "tutorial", "curso"];
          if (hotTerms.some(t => kw.includes(t))) { score += 2; reasons.push("Keyword com intenção comercial"); }
          if (coldTerms.some(t => kw.includes(t))) { score -= 1; reasons.push("Keyword informacional"); }
          
          // Campanha relevance
          const camp = (lead.campanha || "").toLowerCase();
          if (camp.includes("lead") || camp.includes("pesquisa")) { score += 1; reasons.push("Campanha de leads"); }
          
          // Dispositivo (desktop geralmente é mais B2B)
          if ((lead.dispositivo || "").toLowerCase().includes("desktop") || (lead.dispositivo || "").toLowerCase().includes("computer")) {
            score += 1; reasons.push("Desktop (perfil B2B)");
          }
          
          // Classify
          let qualification: "quente" | "morno" | "frio";
          if (score >= 5) qualification = "quente";
          else if (score >= 3) qualification = "morno";
          else qualification = "frio";
          
          return {
            ...lead,
            score,
            qualification,
            reasons,
          };
        });

        // Sort by score desc
        classified.sort((a, b) => b.score - a.score);
        
        const stats = {
          quente: classified.filter(l => l.qualification === "quente").length,
          morno: classified.filter(l => l.qualification === "morno").length,
          frio: classified.filter(l => l.qualification === "frio").length,
        };

        return { leads: classified, total: classified.length, stats };
      } catch (error: any) {
        return { leads: [], total: 0, stats: { quente: 0, morno: 0, frio: 0 }, error: error.message };
      }
    }),
});
