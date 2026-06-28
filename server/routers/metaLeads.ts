/**
 * tRPC router for Meta Ads Lead Forms integration.
 * Fetches lead forms and leads from Facebook Page via Graph API.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { META_PAGE_ID, META_ACCESS_TOKEN } from "../credentials";
// ⚠️  IDs centralizados em server/credentials.ts — não edite aqui

function getMetaToken(): string | null {
  return META_ACCESS_TOKEN || null;
}

const ZENITE_PAGE_ID = META_PAGE_ID;

async function fetchMetaAPI(path: string, params: Record<string, string>, usePageToken = false): Promise<any> {
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

// Simulated leads for when API has no data
function getSimulatedLeads(formId: string) {
  return [
    {
      id: `sim_${formId}_1`,
      created_time: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
      field_data: [
        { name: "full_name", values: ["João Silva"] },
        { name: "email", values: ["joao.silva@empresa.com"] },
        { name: "phone_number", values: ["+5583999990001"] },
        { name: "company_name", values: ["Empresa ABC Ltda"] },
      ],
    },
    {
      id: `sim_${formId}_2`,
      created_time: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
      field_data: [
        { name: "full_name", values: ["Maria Santos"] },
        { name: "email", values: ["maria@construtora.com"] },
        { name: "phone_number", values: ["+5583988880002"] },
        { name: "company_name", values: ["Construtora XYZ"] },
      ],
    },
  ];
}

export const metaLeadsRouter = router({
  // List all lead forms for the Zênite Tech page
  getLeadForms: protectedProcedure.query(async () => {
    const token = getMetaToken();
    if (!token) {
      return {
        forms: [],
        pageId: ZENITE_PAGE_ID,
        pageName: "Zênite Tech",
        isConfigured: false,
      };
    }

    try {
      const data = await fetchMetaAPI(`${ZENITE_PAGE_ID}/leadgen_forms`, {
        fields: "id,name,status,leads_count,created_time,questions",
      });

      const forms = (data.data ?? []).map((f: any) => ({
        id: f.id,
        name: f.name,
        status: f.status as "ACTIVE" | "ARCHIVED" | "DELETED",
        leadsCount: f.leads_count ?? 0,
        createdTime: f.created_time,
        questions: (f.questions ?? []).map((q: any) => q.key ?? q.label ?? q.type),
      }));

      return {
        forms,
        pageId: ZENITE_PAGE_ID,
        pageName: "Zênite Tech",
        isConfigured: true,
      };
    } catch (e: any) {
      console.error("[MetaLeads] getLeadForms error:", e.message);
      return {
        forms: [],
        pageId: ZENITE_PAGE_ID,
        pageName: "Zênite Tech",
        isConfigured: true,
        error: e.message,
      };
    }
  }),

  // Get leads for a specific form
  getLeads: protectedProcedure
    .input(z.object({
      formId: z.string(),
      limit: z.number().min(1).max(100).default(50),
      after: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const token = getMetaToken();
      if (!token) {
        return { leads: getSimulatedLeads(input.formId), isSimulated: true, nextCursor: null };
      }

      try {
        const params: Record<string, string> = {
          fields: "id,created_time,field_data",
          limit: String(input.limit),
        };
        if (input.after) params.after = input.after;

        const data = await fetchMetaAPI(`${input.formId}/leads`, params);
        const leads = (data.data ?? []).map((l: any) => ({
          id: l.id,
          created_time: l.created_time,
          field_data: l.field_data ?? [],
        }));

        return {
          leads,
          isSimulated: false,
          nextCursor: data.paging?.cursors?.after ?? null,
        };
      } catch (e: any) {
        console.error("[MetaLeads] getLeads error:", e.message);
        return {
          leads: getSimulatedLeads(input.formId),
          isSimulated: true,
          nextCursor: null,
          error: e.message,
        };
      }
    }),

  // Get summary stats across all forms
  getSummary: protectedProcedure.query(async () => {
    const token = getMetaToken();
    if (!token) {
      return {
        totalForms: 0,
        activeForms: 0,
        totalLeads: 0,
        recentLeads: 0,
        isConfigured: false,
      };
    }

    try {
      const data = await fetchMetaAPI(`${ZENITE_PAGE_ID}/leadgen_forms`, {
        fields: "id,name,status,leads_count,created_time",
      });

      const forms = data.data ?? [];
      const activeForms = forms.filter((f: any) => f.status === "ACTIVE").length;
      const totalLeads = forms.reduce((sum: number, f: any) => sum + (f.leads_count ?? 0), 0);

      return {
        totalForms: forms.length,
        activeForms,
        totalLeads,
        recentLeads: 0, // Would need date filter
        isConfigured: true,
        forms: forms.map((f: any) => ({
          id: f.id,
          name: f.name,
          status: f.status,
          leadsCount: f.leads_count ?? 0,
          createdTime: f.created_time,
        })),
      };
    } catch (e: any) {
      console.error("[MetaLeads] getSummary error:", e.message);
      return {
        totalForms: 0,
        activeForms: 0,
        totalLeads: 0,
        recentLeads: 0,
        isConfigured: true,
        error: e.message,
      };
    }
  }),
});
