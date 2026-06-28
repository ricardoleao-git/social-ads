import { useState } from "react";
import { CheckCircle, Circle, Copy, Check, ExternalLink, AlertCircle, Clock, ArrowRight, Code2, Database, Server, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const CHECKLIST_ITEMS = [
  { id: 1, label: "Criar arquivo server/jobs/hourlyInstagramSync.ts", category: "código", detail: "Copie o pseudocódigo abaixo e implemente fetchInstagramMetrics() com sua fonte de dados." },
  { id: 2, label: "Criar tabela gads_sync no schema e rodar pnpm db:push", category: "banco", detail: "Adicione o bloco de schema ao drizzle/schema.ts e execute pnpm db:push para criar a tabela." },
  { id: 3, label: "Registrar o job no servidor principal (index.ts)", category: "código", detail: "Importe startHourlyInstagramSync e chame após o servidor Express inicializar." },
  { id: 4, label: "Configurar variável INTEGRATION_API_KEY no .env", category: "config", detail: "Use a mesma chave configurada no Google Ads Dashboard. Obtenha com Ricardo." },
  { id: 5, label: "Configurar variável GADS_DASHBOARD_URL no .env", category: "config", detail: "Valor: https://social-ads.zenitetech.com" },
  { id: 6, label: "Implementar GET /api/integration/health", category: "endpoint", detail: "Retorna { status: 'ok', system: 'instagram-dashboard', timestamp: ... } sem autenticação." },
  { id: 7, label: "Implementar POST /api/integration/gads/receive", category: "endpoint", detail: "Recebe o payload do Google Ads e salva na tabela gads_sync. Autentica via X-Integration-Key." },
  { id: 8, label: "Implementar GET /api/integration/instagram/summary", category: "endpoint", detail: "Retorna métricas atuais do Instagram (seguidores, engajamento, alcance). Autentica via X-Integration-Key." },
  { id: 9, label: "Testar envio para o Google Ads Dashboard via curl", category: "teste", detail: "curl -X POST https://social-ads.zenitetech.com/api/integration/instagram/sync -H 'X-Integration-Key: {KEY}' -H 'Content-Type: application/json' -d '{...}'" },
];

const JOB_CODE = `// server/jobs/hourlyInstagramSync.ts

import cron from "node-cron";
import { db } from "../db";
import { integrationSyncLog } from "../../drizzle/schema";

const GADS_URL = process.env.GADS_DASHBOARD_URL
  ?? "https://social-ads.zenitetech.com";
const API_KEY = process.env.INTEGRATION_API_KEY ?? "";

async function fetchInstagramMetrics() {
  // OPÇÃO A: Buscar do banco de dados local
  // const metrics = await db.query.instagramMetrics.findMany({ ... });

  // OPÇÃO B: Buscar via API do Instagram Graph
  // const response = await fetch(\`https://graph.instagram.com/me/insights?...\`);

  // OPÇÃO C: Buscar do estado atual do dashboard (tabela de cache)
  // const metrics = await db.query.accountMetrics.findFirst({ ... });

  return {
    source: "instagram-dashboard",
    timestamp: new Date().toISOString(),
    period: "7d",
    accounts: [
      {
        username: "zenite.tech",
        followers: 0,           // preencher com dado real
        followersGrowth7d: 0,   // preencher com dado real
        avgEngagementRate: 0,   // preencher com dado real
        totalPosts7d: 0,        // preencher com dado real
        totalReach7d: 0,        // preencher com dado real
        totalImpressions7d: 0   // preencher com dado real
      }
    ]
  };
}

async function sendToGAdsDashboard(metrics: object) {
  const startedAt = Date.now();
  let status = "success";
  let errorMessage = null;

  try {
    const response = await fetch(
      \`\${GADS_URL}/api/integration/instagram/sync\`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Integration-Key": API_KEY,
        },
        body: JSON.stringify(metrics),
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${await response.text()}\`);
    }

    const result = await response.json();
    console.log("[InstagramSync] Enviado com sucesso:", result);

  } catch (err: any) {
    status = "error";
    errorMessage = err.message;
    console.error("[InstagramSync] Falha ao enviar:", err.message);
  } finally {
    await db.insert(integrationSyncLog).values({
      direction: "instagram_to_gads",
      endpoint: \`\${GADS_URL}/api/integration/instagram/sync\`,
      status,
      errorMessage,
      durationMs: Date.now() - startedAt,
      createdAt: new Date(),
    }).catch(() => {});
  }
}

export function startHourlyInstagramSync() {
  // Roda todo hora no minuto :10
  cron.schedule("0 10 * * * *", async () => {
    console.log(\`[InstagramSync] Ciclo \${new Date().toISOString()}\`);
    try {
      const metrics = await fetchInstagramMetrics();
      await sendToGAdsDashboard(metrics);
    } catch (err) {
      console.error("[InstagramSync] Erro no ciclo:", err);
    }
  });

  console.log("[InstagramSync] Job horário registrado (minuto :10)");
}`;

const SCHEMA_CODE = `// drizzle/schema.ts — adicionar ao final do arquivo

export const gadsSyncSnapshots = mysqlTable("gads_sync", {
  id: int("id").autoincrement().primaryKey(),
  receivedAt: timestamp("received_at").defaultNow(),
  period: varchar("period", { length: 10 }).notNull(),
  totalClicks: int("total_clicks").default(0),
  totalImpressions: int("total_impressions").default(0),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).default("0"),
  avgCtr: decimal("avg_ctr", { precision: 5, scale: 2 }).default("0"),
  avgCpc: decimal("avg_cpc", { precision: 5, scale: 2 }).default("0"),
  totalConversions: int("total_conversions").default(0),
  rawJson: text("raw_json"),
});`;

const REGISTER_CODE = `// server/_core/index.ts — adicionar após inicializar o servidor

import { startHourlyInstagramSync } from "../jobs/hourlyInstagramSync";

// Após app.listen():
startHourlyInstagramSync();`;

const HEALTH_CODE = `// GET /api/integration/health (sem autenticação)
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    system: "instagram-dashboard",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});`;

const RECEIVE_CODE = `// POST /api/integration/gads/receive
router.post("/gads/receive", authMiddleware, async (req, res) => {
  const payload = req.body;
  
  await db.insert(gadsSyncSnapshots).values({
    period: payload.period ?? "7d",
    totalClicks: payload.summary?.totalClicks ?? 0,
    totalImpressions: payload.summary?.totalImpressions ?? 0,
    totalCost: payload.summary?.totalCost ?? "0",
    avgCtr: payload.summary?.avgCtr ?? "0",
    avgCpc: payload.summary?.avgCpc ?? "0",
    totalConversions: payload.summary?.totalConversions ?? 0,
    rawJson: JSON.stringify(payload),
  });

  res.json({ success: true, message: "Dados do Google Ads recebidos" });
});`;

const SUMMARY_CODE = `// GET /api/integration/instagram/summary
router.get("/instagram/summary", authMiddleware, async (req, res) => {
  // Buscar métricas mais recentes do banco de dados local
  const latest = await db.query.accountMetrics.findFirst({
    orderBy: (t, { desc }) => [desc(t.createdAt)]
  });

  res.json({
    source: "instagram-dashboard",
    timestamp: new Date().toISOString(),
    accounts: [
      {
        username: "zenite.tech",
        followers: latest?.followers ?? 0,
        avgEngagementRate: latest?.engagementRate ?? 0,
        totalReach7d: latest?.reach7d ?? 0,
      }
    ]
  });
});`;

const categoryColors: Record<string, string> = {
  código: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  banco: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  config: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  endpoint: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  teste: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copiado!", { description: `${label} copiado para a área de transferência.` });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <span className="text-xs font-mono text-muted-foreground">{label}</span>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-2 text-xs gap-1">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <pre className="p-4 text-xs font-mono overflow-x-auto bg-muted/20 text-foreground leading-relaxed max-h-80 overflow-y-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function InstagramJobGuide() {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"job" | "schema" | "register" | "endpoints">("job");

  const toggleItem = (id: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const progress = Math.round((checkedItems.size / CHECKLIST_ITEMS.length) * 100);

  const tabs = [
    { id: "job" as const, label: "Job Horário", icon: Clock },
    { id: "schema" as const, label: "Schema DB", icon: Database },
    { id: "register" as const, label: "Registro", icon: Server },
    { id: "endpoints" as const, label: "Endpoints REST", icon: Zap },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Code2 className="w-6 h-6 text-pink-500" />
            Guia de Implementação — Job Horário do Instagram
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Pseudocódigo completo e checklist para implementar a sincronização bidirecional no Instagram Dashboard.
          </p>
        </div>
        <a
          href="https://social-ads.zenitetech.com/api/integration/health"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-500 hover:underline whitespace-nowrap"
        >
          <ExternalLink className="w-3 h-3" />
          Google Ads API
        </a>
      </div>

      {/* Fluxo de comunicação */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Fluxo de Comunicação Horária</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-col items-center gap-1">
            <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs font-mono text-blue-600 dark:text-blue-400 text-center">
              Google Ads Dashboard<br />
              <span className="text-muted-foreground font-normal">minuto :05</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col items-center gap-1">
            <div className="px-3 py-2 rounded-lg bg-muted border border-border text-xs font-mono text-center">
              POST /instagram/sync<br />
              <span className="text-muted-foreground font-normal">envia resumo do Google Ads</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col items-center gap-1">
            <div className="px-3 py-2 rounded-lg bg-pink-500/10 border border-pink-500/30 text-xs font-mono text-pink-600 dark:text-pink-400 text-center">
              Instagram Dashboard<br />
              <span className="text-muted-foreground font-normal">minuto :10</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col items-center gap-1">
            <div className="px-3 py-2 rounded-lg bg-muted border border-border text-xs font-mono text-center">
              POST /instagram/sync<br />
              <span className="text-muted-foreground font-normal">envia métricas do Instagram</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col items-center gap-1">
            <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs font-mono text-blue-600 dark:text-blue-400 text-center">
              Google Ads Dashboard<br />
              <span className="text-muted-foreground font-normal">salva em instagram_sync</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-yellow-500" />
          <span>Ambos os sistemas usam a mesma <code className="font-mono bg-muted px-1 rounded">INTEGRATION_API_KEY</code> via header <code className="font-mono bg-muted px-1 rounded">X-Integration-Key</code>. O Google Ads Dashboard já está 100% implementado — apenas o lado do Instagram precisa ser construído.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checklist */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Checklist de Implementação</h2>
              <span className="text-xs font-mono text-muted-foreground">{checkedItems.size}/{CHECKLIST_ITEMS.length}</span>
            </div>

            {/* Barra de progresso */}
            <div className="w-full h-2 bg-muted rounded-full mb-4">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="space-y-2">
              {CHECKLIST_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className="w-full flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                >
                  {checkedItems.has(item.id) ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-foreground transition-colors" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs leading-snug ${checkedItems.has(item.id) ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {item.label}
                    </p>
                    <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryColors[item.category]}`}>
                      {item.category}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {progress === 100 && (
              <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-600 dark:text-green-400 text-center font-medium">
                ✓ Implementação completa!
              </div>
            )}
          </div>

          {/* Variáveis de ambiente */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Variáveis de Ambiente</h2>
            <div className="space-y-2">
              {[
                { key: "INTEGRATION_API_KEY", desc: "Chave compartilhada entre os sistemas" },
                { key: "GADS_DASHBOARD_URL", desc: "https://social-ads.zenitetech.com" },
              ].map(env => (
                <div key={env.key} className="p-2 rounded-lg bg-muted/30 border border-border">
                  <code className="text-xs font-mono text-foreground block">{env.key}</code>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{env.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pseudocódigo */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center ${
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "job" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Arquivo principal do job. Implemente <code className="font-mono bg-muted px-1 rounded text-[11px]">fetchInstagramMetrics()</code> com a fonte de dados da sua escolha (banco local, API do Instagram Graph, ou cache do dashboard).
              </p>
              <CodeBlock code={JOB_CODE} label="server/jobs/hourlyInstagramSync.ts" />
            </div>
          )}

          {activeTab === "schema" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Adicione ao final do seu <code className="font-mono bg-muted px-1 rounded text-[11px]">drizzle/schema.ts</code> e execute <code className="font-mono bg-muted px-1 rounded text-[11px]">pnpm db:push</code>.
              </p>
              <CodeBlock code={SCHEMA_CODE} label="drizzle/schema.ts (adição)" />
            </div>
          )}

          {activeTab === "register" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Registre o job no servidor principal após o Express inicializar.
              </p>
              <CodeBlock code={REGISTER_CODE} label="server/_core/index.ts (adição)" />
            </div>
          )}

          {activeTab === "endpoints" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Três endpoints REST que o Instagram Dashboard precisa expor. Adicione ao seu router de integração.
              </p>
              <CodeBlock code={HEALTH_CODE} label="GET /api/integration/health" />
              <CodeBlock code={RECEIVE_CODE} label="POST /api/integration/gads/receive" />
              <CodeBlock code={SUMMARY_CODE} label="GET /api/integration/instagram/summary" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
