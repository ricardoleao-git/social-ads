import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, TrendingUp, FileText, BarChart3, DollarSign,
  Calendar, Users, Search, RefreshCw, CheckCircle, XCircle,
  Clock, Zap, ArrowUp, ArrowDown, Eye, Brain, Instagram,
  Bell, Target, Download, History, Mail, Activity, PauseCircle,
  MessageCircle, KeyRound, FileBarChart, Share2, RotateCcw,
  Star, Timer, Swords, Sheet, Link2
} from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-red-100 text-red-800 border-red-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${map[severity] ?? map.low}`}>{severity}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    suggested: "bg-blue-100 text-blue-800",
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    applied: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
    keep: "bg-green-100 text-green-800",
    negative: "bg-red-100 text-red-800",
    monitor: "bg-yellow-100 text-yellow-800",
    scheduled: "bg-blue-100 text-blue-800",
    published: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-800",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-800"}`}>{status}</span>;
}

function IntentBadge({ intent }: { intent: string }) {
  const map: Record<string, string> = {
    transactional: "bg-green-100 text-green-800",
    informational: "bg-blue-100 text-blue-800",
    navigational: "bg-purple-100 text-purple-800",
    irrelevant: "bg-red-100 text-red-800",
    unknown: "bg-gray-100 text-gray-800",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[intent] ?? "bg-gray-100 text-gray-800"}`}>{intent}</span>;
}

// ─── Seção: Alertas de Anomalia ───────────────────────────────────────────────

function AnomalyAlertsSection() {
  const { data: alerts = [], refetch } = trpc.automations.getAnomalyAlerts.useQuery({ limit: 20, onlyUnresolved: false });
  const runCheck = trpc.automations.runAnomalyCheck.useMutation({ onSuccess: (r) => { toast.success(`Verificação concluída: ${r.detected} alertas detectados`); refetch(); } });
  const resolve = trpc.automations.resolveAlert.useMutation({ onSuccess: () => refetch() });

  const unresolved = alerts.filter(a => !a.resolvedAt);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{unresolved.length} alertas ativos de {alerts.length} total</p>
        </div>
        <Button onClick={() => runCheck.mutate()} disabled={runCheck.isPending} size="sm" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${runCheck.isPending ? "animate-spin" : ""}`} />
          {runCheck.isPending ? "Verificando..." : "Verificar Agora"}
        </Button>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum alerta registrado. Clique em "Verificar Agora" para iniciar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className={`p-4 rounded-lg border ${alert.resolvedAt ? "opacity-50 bg-muted/30" : "bg-card"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${alert.severity === "critical" ? "text-red-500" : alert.severity === "high" ? "text-orange-500" : "text-yellow-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <SeverityBadge severity={alert.severity} />
                      <span className="text-xs text-muted-foreground">{alert.type}</span>
                      {alert.adGroupName && <span className="text-xs font-medium truncate">{alert.adGroupName}</span>}
                    </div>
                    <p className="text-sm">{alert.message}</p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Atual: <strong>{alert.currentValue}</strong></span>
                      <span>Limite: {alert.thresholdValue}</span>
                      <span>{new Date(alert.createdAt).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                </div>
                {!alert.resolvedAt && (
                  <Button size="sm" variant="outline" onClick={() => resolve.mutate({ id: alert.id })} className="flex-shrink-0">
                    <CheckCircle className="w-4 h-4 mr-1" /> Resolver
                  </Button>
                )}
                {alert.resolvedAt && <span className="text-xs text-green-600 flex-shrink-0">✓ Resolvido</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Seção: Ajustes de Lance ──────────────────────────────────────────────────

function BidAdjustmentsSection() {
  const { data: bids = [], refetch } = trpc.automations.getBidAdjustments.useQuery({ limit: 20 });
  const runOptimizer = trpc.automations.runBidOptimizer.useMutation({ onSuccess: (r) => { toast.success(`${r.suggestions} sugestões de lance geradas`); refetch(); } });
  const updateStatus = trpc.automations.updateBidStatus.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{bids.filter(b => b.status === "suggested").length} sugestões pendentes</p>
        <Button onClick={() => runOptimizer.mutate({ autoApply: false })} disabled={runOptimizer.isPending} size="sm" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${runOptimizer.isPending ? "animate-spin" : ""}`} />
          {runOptimizer.isPending ? "Analisando..." : "Analisar Lances"}
        </Button>
      </div>

      {bids.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma sugestão de lance. Clique em "Analisar Lances" para gerar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bids.map((bid) => {
            const pct = Number(bid.adjustmentPct ?? 0);
            const isUp = pct > 0;
            const oldBid = Number(bid.oldBidMicros ?? 0) / 1_000_000;
            const newBid = Number(bid.newBidMicros ?? 0) / 1_000_000;
            return (
              <div key={bid.id} className="p-4 rounded-lg border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StatusBadge status={bid.status ?? "suggested"} />
                      {isUp ? <ArrowUp className="w-4 h-4 text-green-500" /> : <ArrowDown className="w-4 h-4 text-red-500" />}
                      <span className={`text-sm font-bold ${isUp ? "text-green-600" : "text-red-600"}`}>{isUp ? "+" : ""}{pct}%</span>
                      <span className="text-sm font-medium truncate">{bid.adGroupName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{bid.campaignName}</p>
                    <p className="text-sm">{bid.reason}</p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Lance atual: <strong>R$ {oldBid.toFixed(2)}</strong></span>
                      <span>Novo lance: <strong>R$ {newBid.toFixed(2)}</strong></span>
                      <span>{bid.triggerMetric}</span>
                    </div>
                  </div>
                  {bid.status === "suggested" && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => updateStatus.mutate({ id: bid.id, status: "approved" })}>
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => updateStatus.mutate({ id: bid.id, status: "rejected" })}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Seção: Sugestões RSA ─────────────────────────────────────────────────────

function RsaSuggestionsSection() {
  const { data: rsas = [], refetch } = trpc.automations.getRsaSuggestions.useQuery({ limit: 20 });
  const runScore = trpc.automations.runRsaQualityScore.useMutation({ onSuccess: (r) => { toast.success(`${r.suggestions} sugestões de RSA geradas por IA`); refetch(); } });
  const updateStatus = trpc.automations.updateRsaSuggestionStatus.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rsas.filter(r => r.status === "pending").length} RSAs aguardando revisão</p>
        <Button onClick={() => runScore.mutate()} disabled={runScore.isPending} size="sm" className="gap-2">
          <Brain className={`w-4 h-4 ${runScore.isPending ? "animate-spin" : ""}`} />
          {runScore.isPending ? "Analisando com IA..." : "Analisar RSAs com IA"}
        </Button>
      </div>

      {rsas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma sugestão de RSA. Clique em "Analisar RSAs com IA" para gerar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rsas.map((rsa) => (
            <div key={rsa.id} className="p-4 rounded-lg border bg-card">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={rsa.status ?? "pending"} />
                    <span className="text-xs text-muted-foreground">Ad Strength: <strong>{rsa.currentAdStrength}</strong></span>
                  </div>
                  <p className="font-medium text-sm">{rsa.adGroupName}</p>
                  <p className="text-xs text-muted-foreground">{rsa.campaignName}</p>
                </div>
                {rsa.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => updateStatus.mutate({ id: rsa.id, status: "approved" })}>
                      <CheckCircle className="w-4 h-4 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => updateStatus.mutate({ id: rsa.id, status: "rejected" })}>
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">HEADLINES SUGERIDAS</p>
                  <div className="space-y-1">
                    {((rsa.suggestedHeadlines as string[]) ?? []).map((h, i) => (
                      <div key={i} className="text-xs bg-green-50 text-green-800 px-2 py-1 rounded">{h}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">DESCRIPTIONS SUGERIDAS</p>
                  <div className="space-y-1">
                    {((rsa.suggestedDescriptions as string[]) ?? []).map((d, i) => (
                      <div key={i} className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded">{d}</div>
                    ))}
                  </div>
                </div>
              </div>

              {rsa.reasoning && (
                <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                  <strong>Raciocínio da IA:</strong> {rsa.reasoning}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Seção: Termos de Pesquisa ────────────────────────────────────────────────

function SearchTermsSection() {
  const { data: terms = [], refetch } = trpc.automations.getSearchTermAnalysis.useQuery({ limit: 30 });
  const runAnalysis = trpc.automations.runSearchTermAnalysis.useMutation({ onSuccess: (r) => { toast.success(`${r.analyzed} termos analisados, ${r.toNegative} para negativar`); refetch(); } });
  const updateDecision = trpc.automations.updateSearchTermDecision.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {terms.filter(t => t.decision === "negative").length} para negativar ·{" "}
          {terms.filter(t => t.decision === "keep").length} manter ·{" "}
          {terms.filter(t => t.decision === "monitor").length} monitorar
        </p>
        <Button onClick={() => runAnalysis.mutate()} disabled={runAnalysis.isPending} size="sm" className="gap-2">
          <Brain className={`w-4 h-4 ${runAnalysis.isPending ? "animate-spin" : ""}`} />
          {runAnalysis.isPending ? "Classificando com IA..." : "Analisar Termos"}
        </Button>
      </div>

      {terms.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum termo analisado. Clique em "Analisar Termos" para classificar com IA.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2 pr-4">Termo</th>
                <th className="text-left py-2 pr-4">Grupo</th>
                <th className="text-center py-2 pr-4">Imp.</th>
                <th className="text-center py-2 pr-4">Cliques</th>
                <th className="text-center py-2 pr-4">Conv.</th>
                <th className="text-center py-2 pr-4">Score</th>
                <th className="text-center py-2 pr-4">Intenção</th>
                <th className="text-center py-2 pr-4">Decisão</th>
                <th className="text-center py-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((term) => (
                <tr key={term.id} className="border-b hover:bg-muted/30">
                  <td className="py-2 pr-4 max-w-[200px]">
                    <span className="truncate block font-medium">{term.term}</span>
                  </td>
                  <td className="py-2 pr-4 text-xs text-muted-foreground max-w-[150px]">
                    <span className="truncate block">{term.adGroupName}</span>
                  </td>
                  <td className="py-2 pr-4 text-center">{term.impressions}</td>
                  <td className="py-2 pr-4 text-center">{term.clicks}</td>
                  <td className="py-2 pr-4 text-center">{term.conversions}</td>
                  <td className="py-2 pr-4 text-center">
                    <span className={`font-bold ${Number(term.relevanceScore) >= 0.7 ? "text-green-600" : Number(term.relevanceScore) >= 0.4 ? "text-yellow-600" : "text-red-600"}`}>
                      {Number(term.relevanceScore).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-center"><IntentBadge intent={term.intent ?? "unknown"} /></td>
                  <td className="py-2 pr-4 text-center"><StatusBadge status={term.decision ?? "pending"} /></td>
                  <td className="py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button title="Manter" onClick={() => updateDecision.mutate({ id: term.id, decision: "keep" })} className="p-1 hover:bg-green-100 rounded text-green-600"><CheckCircle className="w-3.5 h-3.5" /></button>
                      <button title="Negativar" onClick={() => updateDecision.mutate({ id: term.id, decision: "negative" })} className="p-1 hover:bg-red-100 rounded text-red-600"><XCircle className="w-3.5 h-3.5" /></button>
                      <button title="Monitorar" onClick={() => updateDecision.mutate({ id: term.id, decision: "monitor" })} className="p-1 hover:bg-yellow-100 rounded text-yellow-600"><Eye className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Seção: Concorrência ──────────────────────────────────────────────────────

function CompetitionSection() {
  const { data: snapshots = [], refetch } = trpc.automations.getAuctionSnapshots.useQuery({ limit: 30 });
  const runInsights = trpc.automations.runAuctionInsights.useMutation({ onSuccess: (r) => { toast.success(`${r.inserted} concorrentes mapeados, ${r.newCompetitors} novos`); refetch(); } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{snapshots.filter(s => s.isNew).length} novos concorrentes detectados</p>
        <Button onClick={() => runInsights.mutate()} disabled={runInsights.isPending} size="sm" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${runInsights.isPending ? "animate-spin" : ""}`} />
          {runInsights.isPending ? "Mapeando..." : "Mapear Concorrentes"}
        </Button>
      </div>

      {snapshots.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum dado de concorrência. Clique em "Mapear Concorrentes" para iniciar.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2 pr-4">Concorrente</th>
                <th className="text-left py-2 pr-4">Grupo</th>
                <th className="text-center py-2 pr-4">Imp. Share</th>
                <th className="text-center py-2 pr-4">Overlap</th>
                <th className="text-center py-2 pr-4">Acima de nós</th>
                <th className="text-center py-2 pr-4">Top of Page</th>
                <th className="text-center py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id} className={`border-b hover:bg-muted/30 ${s.isNew ? "bg-orange-50" : ""}`}>
                  <td className="py-2 pr-4 font-medium">{s.competitor} {s.isNew && <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">NOVO</span>}</td>
                  <td className="py-2 pr-4 text-xs text-muted-foreground max-w-[150px]"><span className="truncate block">{s.adGroupName}</span></td>
                  <td className="py-2 pr-4 text-center font-bold">{s.impressionShare}</td>
                  <td className="py-2 pr-4 text-center">{s.overlapRate}</td>
                  <td className="py-2 pr-4 text-center text-orange-600">{s.positionAboveRate}</td>
                  <td className="py-2 pr-4 text-center">{s.topOfPageRate}</td>
                  <td className="py-2 text-center">
                    <span className="text-xs text-muted-foreground">{s.snapshotDate}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Seção: Calendário Editorial ──────────────────────────────────────────────

function EditorialCalendarSection() {
  const { data: entries = [], refetch } = trpc.automations.getEditorialCalendar.useQuery({ accountId: "ricardo_leao", limit: 14 });
  const generate = trpc.automations.generateEditorialSuggestions.useMutation({ onSuccess: (r) => { toast.success(`${r.generated} sugestões de conteúdo geradas por IA`); refetch(); } });
  const updateStatus = trpc.automations.updateEditorialStatus.useMutation({ onSuccess: () => refetch() });

  const contentTypeIcon: Record<string, string> = { reel: "🎬", carousel: "🖼️", image: "📸", story: "⭕" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{entries.filter(e => e.status === "suggested").length} sugestões pendentes · {entries.filter(e => e.status === "scheduled").length} agendadas</p>
        <Button onClick={() => generate.mutate({ accountId: "ricardo_leao", weeksAhead: 1 })} disabled={generate.isPending} size="sm" className="gap-2">
          <Brain className={`w-4 h-4 ${generate.isPending ? "animate-spin" : ""}`} />
          {generate.isPending ? "Gerando com IA..." : "Gerar Sugestões IA"}
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma sugestão de conteúdo. Clique em "Gerar Sugestões IA" para criar o calendário editorial.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="p-4 rounded-lg border bg-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="text-2xl">{contentTypeIcon[entry.contentType ?? "image"] ?? "📸"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StatusBadge status={entry.status ?? "suggested"} />
                      <span className="text-xs text-muted-foreground">{entry.suggestedDate} às {entry.suggestedTime}</span>
                      {entry.relatedProduct && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{entry.relatedProduct}</span>}
                    </div>
                    <p className="font-medium text-sm">{entry.topic}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.caption}</p>
                    {Boolean(entry.hashtags) && (
                      <p className="text-xs text-blue-600 mt-1">{String(entry.hashtags)}</p>
                    )}
                    {entry.estimatedEngagement && (
                      <p className="text-xs text-green-600 mt-0.5">📈 Engajamento estimado: {entry.estimatedEngagement}%</p>
                    )}
                  </div>
                </div>
                {entry.status === "suggested" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => updateStatus.mutate({ id: entry.id, status: "scheduled" })}>
                      <Clock className="w-4 h-4 mr-1" /> Agendar
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => updateStatus.mutate({ id: entry.id, status: "cancelled" })}>
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Seção: Snapshots Instagram ───────────────────────────────────────────────

function InstagramSnapshotsSection() {
  const { data: snapshots = [] } = trpc.automations.getInstagramHistory.useQuery({ accountId: "ricardo_leao", limit: 14 });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{snapshots.length} snapshots históricos registrados</p>

      {snapshots.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Instagram className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum snapshot histórico. Os dados são salvos automaticamente quando você acessa os dados ao vivo na página de Integração.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2 pr-4">Data</th>
                <th className="text-left py-2 pr-4">Conta</th>
                <th className="text-center py-2 pr-4">Seguidores</th>
                <th className="text-center py-2 pr-4">Posts</th>
                <th className="text-center py-2 pr-4">Avg Likes</th>
                <th className="text-center py-2">Engajamento</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap) => (
                <tr key={snap.id} className="border-b hover:bg-muted/30">
                  <td className="py-2 pr-4 text-xs">{snap.snapshotDate}</td>
                  <td className="py-2 pr-4">@{snap.username}</td>
                  <td className="py-2 pr-4 text-center font-bold">{snap.followers?.toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-4 text-center">{snap.totalPosts}</td>
                  <td className="py-2 pr-4 text-center">{snap.avgLikes}</td>
                  <td className="py-2 text-center">
                    <span className={`font-bold ${Number(snap.engagementRate) >= 3 ? "text-green-600" : "text-yellow-600"}`}>{snap.engagementRate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Seção: Insights Integrados ───────────────────────────────────────────────

function IntegratedInsightsSection() {
  const { data: insights } = trpc.automations.getIntegratedInsights.useQuery();

  if (!insights) return <div className="text-center py-12 text-muted-foreground"><RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin opacity-30" /><p>Carregando insights...</p></div>;

  return (
    <div className="space-y-6">
      {insights.opportunities.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2"><Zap className="w-4 h-4" /> Oportunidades de Ação</h3>
          <ul className="space-y-1">
              {(insights.opportunities as string[]).map((opp, i) => (
              <li key={i} className="text-sm text-amber-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />
                {opp}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-orange-500" /> Alertas Ativos</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{insights.alerts.filter(a => !a.resolvedAt).length}</p><p className="text-xs text-muted-foreground">de {insights.alerts.length} total</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-blue-500" /> Ajustes de Lance</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{insights.bidSuggestions.length}</p><p className="text-xs text-muted-foreground">aguardando aprovação</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-purple-500" /> RSAs para Melhorar</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{insights.rsaSuggestions.length}</p><p className="text-xs text-muted-foreground">sugestões pendentes</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Search className="w-4 h-4 text-red-500" /> Termos p/ Negativar</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{insights.searchTerms.filter(t => t.decision === "negative").length}</p><p className="text-xs text-muted-foreground">de {insights.searchTerms.length} analisados</p></CardContent>
        </Card>
      </div>

      {insights.instagram && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Instagram className="w-4 h-4" /> Último Snapshot Instagram</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div><p className="text-2xl font-bold">{insights.instagram.followers?.toLocaleString("pt-BR")}</p><p className="text-xs text-muted-foreground">Seguidores</p></div>
              <div><p className="text-2xl font-bold">{insights.instagram.totalPosts}</p><p className="text-xs text-muted-foreground">Posts</p></div>
              <div><p className="text-2xl font-bold">{insights.instagram.avgLikes}</p><p className="text-xs text-muted-foreground">Avg Likes</p></div>
              <div><p className="text-2xl font-bold text-green-600">{insights.instagram.engagementRate}%</p><p className="text-xs text-muted-foreground">Engajamento</p></div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Snapshot de {insights.instagram.snapshotDate} · @{insights.instagram.username}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Painel de Logs de Execução ───────────────────────────────────────────────

function ExecutionLogsPanel() {
  const { data: result, isLoading, refetch } = trpc.automations.getExecutionLogs.useQuery({ limit: 20 });
  const logs = result?.logs ?? [];

  const handleExportCSV = () => {
    if (!logs?.length) return;
    const headers = ["Automação", "Status", "Resumo", "Duração (ms)", "Acionado por", "E-mail enviado", "Data"];
    const rows = logs.map((l: any) => [
      l.automationLabel,
      l.status,
      l.summary ?? "",
      l.durationMs ?? "",
      l.triggeredBy ?? "manual",
      l.emailSent ? "Sim" : "Não",
      new Date(l.createdAt).toLocaleString("pt-BR")
    ]);
    const csv = [headers, ...rows].map(r => r.map(String).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `automacoes-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso!");
  };

  const statusIcon = (s: string) => {
    if (s === "success") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (s === "error") return <XCircle className="w-4 h-4 text-red-500" />;
    if (s === "running") return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            Histórico de Execuções
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando logs...</p>
        ) : !logs?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma execução registrada ainda.</p>
            <p className="text-xs mt-1">Execute uma automação para ver o histórico aqui.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="mt-0.5">{statusIcon(log.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{log.automationLabel}</span>
                    {log.emailSent && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Mail className="w-3 h-3" /> E-mail enviado</span>}
                    {log.durationMs && <span className="text-xs text-muted-foreground">{log.durationMs}ms</span>}
                  </div>
                  {log.summary && <p className="text-xs text-muted-foreground mt-0.5">{log.summary}</p>}
                  {log.errorMessage && <p className="text-xs text-red-500 mt-0.5">{log.errorMessage}</p>}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

// ─── Seção: Novos Jobs (Auto-1 a Auto-13) ───────────────────────────────────
function JobToggle({ jobName }: { jobName: string }) {
  const { data: jobs = [] } = trpc.jobConfigs.list.useQuery();
  const utils = trpc.useUtils();
  const toggle = trpc.jobConfigs.toggle.useMutation({
    onSuccess: () => utils.jobConfigs.list.invalidate(),
    onError: () => toast.error("Erro ao alterar status do job"),
  });
  const job = jobs.find(j => j.jobName === jobName);
  const enabled = job?.enabled ?? true;
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={enabled}
        onCheckedChange={(val) => toggle.mutate({ jobName, enabled: val })}
        disabled={toggle.isPending}
      />
      <span className={`text-xs font-medium ${enabled ? "text-green-700" : "text-red-600"}`}>
        {enabled ? "Ativo" : "Pausado"}
      </span>
    </div>
  );
}

function NewJobsSection({ jobId }: { jobId: string }) {
  const jobDetails: Record<string, { title: string; schedule: string; logic: string; output: string; icon: React.ReactNode }> = {
    auto1: {
      title: "Auto-1: Sync WhatsApp Conversão",
      schedule: "Todo dia às 9h (Brasília)",
      logic: "Verifica se o evento whatsapp_click está marcado como evento principal no GA4 e se já foi importado como conversão no Google Ads. Se não encontrar, envia alerta por e-mail com instruções para importação manual.",
      output: "Notificação por e-mail se a conversão não estiver ativa.",
      icon: <MessageCircle className="w-8 h-8 text-green-600" />,
    },
    auto2: {
      title: "Auto-2: Alerta de Orçamento Esgotado",
      schedule: "A cada hora entre 8h e 18h (dias úteis)",
      logic: "Monitora o orçamento diário das campanhas ativas. Se mais de 80% do orçamento for consumido antes das 16h, dispara alerta urgente para avaliar aumento de verba ou aguardar o próximo dia.",
      output: "Alerta por e-mail com campanha, % gasto e hora de esgotamento estimada.",
      icon: <Bell className="w-8 h-8 text-red-500" />,
    },
    auto3: {
      title: "Auto-3: Pausa de Keywords Caras",
      schedule: "Todo dia às 7h (Brasília)",
      logic: "Identifica keywords com CPC médio acima de R$5,00 e zero conversões nos últimos 7 dias. Pausa automaticamente via API do Google Ads e registra no log.",
      output: "Keywords pausadas + log de execução com economia estimada.",
      icon: <KeyRound className="w-8 h-8 text-orange-500" />,
    },
    auto4: {
      title: "Auto-4: Relatório Diário de Performance",
      schedule: "Todo dia às 8h (Brasília)",
      logic: "Coleta métricas do dia anterior via Google Ads API: gasto total, conversões, CTR médio, CPC médio, grupos com anomalia. Gera resumo executivo e envia por e-mail.",
      output: "E-mail diário com KPIs, variação vs. dia anterior e alertas.",
      icon: <FileBarChart className="w-8 h-8 text-blue-600" />,
    },
    auto5: {
      title: "Auto-5: Sync de Negativos Entre Campanhas",
      schedule: "Toda segunda às 7h (Brasília)",
      logic: "Compara a lista de negativos entre todas as campanhas ativas. Identifica negativos presentes em uma campanha mas ausentes em outras e replica automaticamente para garantir consistência.",
      output: "Log com negativos sincronizados + e-mail se houver inconsistências.",
      icon: <Share2 className="w-8 h-8 text-purple-500" />,
    },
    auto6: {
      title: "Auto-6: Alerta de Quality Score",
      schedule: "Toda sexta às 9h (Brasília)",
      logic: "Verifica o Quality Score de todas as keywords ativas. Keywords com QS < 7 recebem alerta com sugestões de melhoria (copy, landing page, correspondência).",
      output: "Relatório semanal de QS com keywords críticas e recomendações.",
      icon: <Star className="w-8 h-8 text-yellow-500" />,
    },
    auto7: {
      title: "Auto-7: Monitor de Landing Pages",
      schedule: "A cada hora (Brasília)",
      logic: "Faz requisição HTTP para todas as URLs de destino dos anúncios ativos. Se retornar status 4xx ou 5xx, ou tempo de resposta > 5s, dispara alerta imediato.",
      output: "Alerta urgente por e-mail se landing page estiver fora do ar.",
      icon: <Link2 className="w-8 h-8 text-teal-500" />,
    },
    auto8: {
      title: "Auto-8: Relatório de Conversões por Canal",
      schedule: "Toda segunda às 8h30 (Brasília)",
      logic: "Cruza dados do GA4 com Google Ads para segmentar conversões por canal: Paid Search, Orgânico, Direto, Social. Identifica qual canal gera mais leads qualificados.",
      output: "Relatório semanal com distribuição de conversões por canal e tendência.",
      icon: <BarChart3 className="w-8 h-8 text-indigo-500" />,
    },
    auto9: {
      title: "Auto-9: Reativação de Grupos Pausados",
      schedule: "Todo dia às 10h (Brasília)",
      logic: "Avalia grupos pausados que tiveram conversões históricas. Se o volume de busca das keywords aumentou ou se há sazonalidade favorável, sugere reativação com orçamento controlado.",
      output: "Lista de candidatos à reativação com justificativa e orçamento sugerido.",
      icon: <RotateCcw className="w-8 h-8 text-cyan-500" />,
    },
    auto10: {
      title: "Auto-10: Score de Lead via IA",
      schedule: "Todo dia às 11h (Brasília)",
      logic: "Analisa padrões das conversões recentes (hora, dispositivo, keyword, grupo) e classifica leads por probabilidade de fechar negócio. Usa LLM para gerar insights sobre o perfil dos leads de maior valor.",
      output: "Relatório diário com score dos leads e perfil do lead ideal.",
      icon: <Brain className="w-8 h-8 text-violet-500" />,
    },
    auto11: {
      title: "Auto-11: Dayparting Automático",
      schedule: "Todo domingo às 6h (Brasília)",
      logic: "Analisa conversões por hora do dia e dia da semana nos últimos 30 dias. Identifica horários de pico (> média + 20%) e vale (< média - 20%). Aplica multiplicadores de lance via API: +20% no pico, -30% no vale.",
      output: "Ajustes de lance aplicados + relatório de horários de pico identificados.",
      icon: <Timer className="w-8 h-8 text-amber-500" />,
    },
    auto12: {
      title: "Auto-12: Alerta de Concorrentes",
      schedule: "Toda quarta às 9h (Brasília)",
      logic: "Monitora os Auction Insights do Google Ads para os termos estratégicos. Detecta novos concorrentes que não estavam presentes na semana anterior e calcula a taxa de sobreposição.",
      output: "Alerta por e-mail quando novo concorrente detectado com taxa de sobreposição > 10%.",
      icon: <Swords className="w-8 h-8 text-red-600" />,
    },
    auto13: {
      title: "Auto-13: Sync Leads com Google Sheets",
      schedule: "Todo dia às 9h30 (Brasília)",
      logic: "Exporta todas as conversões do Google Ads do dia anterior para uma planilha Google Sheets dedicada. Cada linha contém: data, grupo de anúncios, keyword, dispositivo, custo e tipo de conversão.",
      output: "Planilha Google Sheets atualizada diariamente com histórico de conversões.",
      icon: <Sheet className="w-8 h-8 text-green-700" />,
    },
  };

  const job = jobDetails[jobId];
  if (!job) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-muted rounded-lg flex-shrink-0">{job.icon}</div>
        <div className="flex-1">
          <h3 className="font-semibold text-base">{job.title}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{job.schedule}</span>
            <JobToggle jobName={jobId.replace("auto", "auto") === "auto1" ? "whatsappConversionSync" : jobId === "auto2" ? "budgetAlert" : jobId === "auto3" ? "autoPauseKeywords" : jobId === "auto4" ? "dailyPerformanceReport" : jobId === "auto5" ? "negativesSync" : jobId === "auto6" ? "qualityScoreAlert" : jobId === "auto7" ? "landingPageMonitor" : jobId === "auto8" ? "conversionChannelReport" : jobId === "auto9" ? "autoReactivation" : jobId === "auto10" ? "leadScoring" : jobId === "auto11" ? "dayparting" : jobId === "auto12" ? "competitorAlert" : "leadsSheetSync"} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-muted/40 border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Lógica de Execução</p>
          <p className="text-sm leading-relaxed">{job.logic}</p>
        </div>
        <div className="p-4 rounded-lg bg-muted/40 border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Saída / Resultado</p>
          <p className="text-sm leading-relaxed">{job.output}</p>
        </div>
      </div>
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
        <p className="text-xs text-blue-700">
          <strong>Histórico:</strong> As execuções deste job são registradas no painel de Histórico de Execuções abaixo.
        </p>
      </div>
    </div>
  );
}

// ─── Seção: Pausa Automática ─────────────────────────────────────────────────

function AutoPauseSection() {
  const { data: proposals = [], refetch } = trpc.autoPause.list.useQuery({ status: "all" });
  const approve = trpc.autoPause.approve.useMutation({ onSuccess: () => { toast.success("Proposta aprovada!"); refetch(); } });
  const reject = trpc.autoPause.reject.useMutation({ onSuccess: () => { toast.success("Proposta rejeitada."); refetch(); } });

  const pending = proposals.filter(p => p.status === "pending");
  const reviewed = proposals.filter(p => p.status !== "pending");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pending.length} proposta(s) aguardando revisão • {reviewed.length} revisada(s)
        </p>
        <Button onClick={() => refetch()} size="sm" variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      {proposals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <PauseCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma proposta de pausa</p>
          <p className="text-xs mt-1">O job diário (9h) verifica grupos com CTR &lt; 2% por 7 dias e cria propostas aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" /> Aguardando Revisão ({pending.length})
              </h3>
              {pending.map((p) => (
                <div key={p.id} className="p-4 rounded-lg border bg-yellow-50 border-yellow-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{p.adGroupName}</p>
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span>CTR médio: <strong className="text-red-600">{Number(p.avgCtr ?? 0).toFixed(2)}%</strong></span>
                        <span>Gasto total: <strong>R$ {Number(p.totalSpend ?? 0).toFixed(2)}</strong></span>
                        <span>Detectado: {new Date(p.createdAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p className="text-xs text-yellow-700 mt-1">CTR abaixo de 2% nos últimos 7 dias. Pausa recomendada para economizar orçamento.</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-foreground gap-1" onClick={() => approve.mutate({ id: p.id, reviewNote: "Aprovado via painel" })} disabled={approve.isPending}>
                        <CheckCircle className="w-3 h-3" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-1" onClick={() => reject.mutate({ id: p.id, reviewNote: "Rejeitado via painel" })} disabled={reject.isPending}>
                        <XCircle className="w-3 h-3" /> Rejeitar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {reviewed.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" /> Histórico ({reviewed.length})
              </h3>
              {reviewed.map((p) => (
                <div key={p.id} className="p-3 rounded-lg border bg-muted/30 opacity-70">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{p.adGroupName}</p>
                      <p className="text-xs text-muted-foreground">CTR: {Number(p.avgCtr ?? 0).toFixed(2)}% • Gasto: R$ {Number(p.totalSpend ?? 0).toFixed(2)} • {p.reviewedBy && `Revisado por ${p.reviewedBy}`}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AutomationsHub() {
  const [activeTab, setActiveTab] = useState("overview");

  const automations = [
    { id: "anomaly", icon: <AlertTriangle className="w-5 h-5 text-orange-500" />, title: "Alertas de Anomalia", desc: "Monitoramento a cada 4h de CTR, CPC e conversões", status: "ativo", freq: "A cada 4h" },
    { id: "instagram", icon: <Instagram className="w-5 h-5 text-pink-500" />, title: "Sync Diário Instagram", desc: "Snapshot diário de seguidores, posts e engajamento", status: "ativo", freq: "Diário" },
    { id: "rsa", icon: <Brain className="w-5 h-5 text-purple-500" />, title: "Score RSA com IA", desc: "Análise semanal de Ad Strength e sugestões de melhoria", status: "ativo", freq: "Semanal" },
    { id: "integrated", icon: <BarChart3 className="w-5 h-5 text-blue-500" />, title: "Relatório Integrado", desc: "Cruzamento de dados Ads + Social para oportunidades", status: "ativo", freq: "Sob demanda" },
    { id: "bids", icon: <DollarSign className="w-5 h-5 text-green-500" />, title: "Otimização de Lances", desc: "Regras automáticas de ajuste de CPC por performance", status: "ativo", freq: "Semanal" },
    { id: "editorial", icon: <Calendar className="w-5 h-5 text-indigo-500" />, title: "Calendário Editorial IA", desc: "Sugestões semanais de posts para Instagram", status: "ativo", freq: "Semanal" },
    { id: "competition", icon: <Target className="w-5 h-5 text-red-500" />, title: "Dashboard Concorrência", desc: "Auction Insights e alertas de novos concorrentes", status: "ativo", freq: "Diário" },
    { id: "searchterms", icon: <Search className="w-5 h-5 text-teal-500" />, title: "Análise de Termos IA", desc: "Classificação de intenção e decisão de negativação", status: "ativo", freq: "Semanal" },
    { id: "autopause", icon: <PauseCircle className="w-5 h-5 text-amber-500" />, title: "Pausa Automática", desc: "Propostas de pausa para grupos com CTR < 2% por 7 dias", status: "ativo", freq: "Diário" },
    { id: "monthly", icon: <FileText className="w-5 h-5 text-emerald-500" />, title: "Relatório Mensal Executivo", desc: "KPIs do mês, comparação MoM, análise IA, PDF e e-mail automático", status: "ativo", freq: "Mensal (dia 1º)" },
    // Novos 13 jobs (Auto-1 a Auto-13)
    { id: "auto1", icon: <MessageCircle className="w-5 h-5 text-green-600" />, title: "Auto-1: WhatsApp Conversão", desc: "Verifica e importa whatsapp_click como conversão no Google Ads", status: "ativo", freq: "Diário 9h" },
    { id: "auto2", icon: <Bell className="w-5 h-5 text-red-500" />, title: "Auto-2: Alerta Orçamento", desc: "Alerta quando orçamento diário esgota antes das 18h", status: "ativo", freq: "A cada hora" },
    { id: "auto3", icon: <KeyRound className="w-5 h-5 text-orange-500" />, title: "Auto-3: Pausa Keywords Caras", desc: "Pausa keywords com CPC > R$5 e zero conversão em 7 dias", status: "ativo", freq: "Diário 7h" },
    { id: "auto4", icon: <FileBarChart className="w-5 h-5 text-blue-600" />, title: "Auto-4: Relatório Diário", desc: "Resumo diário de gasto, conversões, CTR e anomalias por e-mail", status: "ativo", freq: "Diário 8h" },
    { id: "auto5", icon: <Share2 className="w-5 h-5 text-purple-500" />, title: "Auto-5: Sync Negativos", desc: "Replica negativos entre campanhas automaticamente", status: "ativo", freq: "Semanal seg 7h" },
    { id: "auto6", icon: <Star className="w-5 h-5 text-yellow-500" />, title: "Auto-6: Quality Score", desc: "Alerta de keywords com Quality Score < 7", status: "ativo", freq: "Semanal sex 9h" },
    { id: "auto7", icon: <Link2 className="w-5 h-5 text-teal-500" />, title: "Auto-7: Monitor Landing Pages", desc: "Verifica status HTTP das landing pages dos anúncios", status: "ativo", freq: "A cada hora" },
    { id: "auto8", icon: <BarChart3 className="w-5 h-5 text-indigo-500" />, title: "Auto-8: Conversões por Canal", desc: "Relatório de conversões segmentado por canal (Ads, Orgânico, Direto)", status: "ativo", freq: "Semanal seg 8h30" },
    { id: "auto9", icon: <RotateCcw className="w-5 h-5 text-cyan-500" />, title: "Auto-9: Reativação de Grupos", desc: "Avalia grupos pausados com potencial de reativação", status: "ativo", freq: "Diário 10h" },
    { id: "auto10", icon: <Brain className="w-5 h-5 text-violet-500" />, title: "Auto-10: Score de Lead IA", desc: "Classifica leads por probabilidade de conversão via IA", status: "ativo", freq: "Diário 11h" },
    { id: "auto11", icon: <Timer className="w-5 h-5 text-amber-500" />, title: "Auto-11: Dayparting", desc: "Analisa horários de pico e sugere ajustes de lance por hora", status: "ativo", freq: "Semanal dom 6h" },
    { id: "auto12", icon: <Swords className="w-5 h-5 text-red-600" />, title: "Auto-12: Alerta Concorrentes", desc: "Detecta novos concorrentes nos leilões dos termos estratégicos", status: "ativo", freq: "Semanal qua 9h" },
    { id: "auto13", icon: <Sheet className="w-5 h-5 text-green-700" />, title: "Auto-13: Sync Leads Sheets", desc: "Exporta conversões do Google Ads para planilha Google Sheets", status: "ativo", freq: "Diário 9h30" },
  ];

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            Central de Automações
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">23 automações de gestão de tráfego pago — todas controladas em um único painel</p>
        </div>

        {/* ─── Status de Configuração do Sistema ──────────────────────────── */}
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            Status de Configuração do Sistema
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-green-800">Google Ads API</p>
                <p className="text-xs text-green-600">Conectado e ativo</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-yellow-800">WhatsApp (Evolution)</p>
                <p className="text-xs text-yellow-600">Aguardando credenciais</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-green-800">GA4 → Google Ads</p>
                <p className="text-xs text-green-600">Vinculado em 07/04/2026</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-yellow-800">Meta Ads</p>
                <p className="text-xs text-yellow-600">Token de acesso necessário</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            ⚠️ <strong>WhatsApp:</strong> configure EVOLUTION_API_KEY, EVOLUTION_API_URL e EVOLUTION_INSTANCE_NAME nos secrets do projeto.
            • <strong>Meta Ads:</strong> configure META_ADS_ACCESS_TOKEN e META_ADS_ACCOUNT_ID.
            • <strong>GA4:</strong> acesse analytics.google.com → Admin → Vinculações de produtos → Google Ads.
          </p>
        </div>

        {/* Cards de status das automações */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {automations.map((auto) => (
            <button
              key={auto.id}
              onClick={() => setActiveTab(auto.id)}
              className={`p-3 rounded-lg border text-left transition-all hover:shadow-md ${activeTab === auto.id ? "border-primary bg-primary/5 shadow-sm" : "bg-card hover:border-primary/50"}`}
            >
              <div className="flex items-center justify-between mb-2">
                {auto.icon}
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{auto.status}</span>
              </div>
              <p className="font-semibold text-xs leading-tight">{auto.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{auto.freq}</p>
            </button>
          ))}
        </div>

        {/* Conteúdo das abas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {automations.find(a => a.id === activeTab)?.icon}
              {automations.find(a => a.id === activeTab)?.title ?? "Visão Geral"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{automations.find(a => a.id === activeTab)?.desc}</p>
          </CardHeader>
          <CardContent>
            {activeTab === "overview" && <IntegratedInsightsSection />}
            {activeTab === "anomaly" && <AnomalyAlertsSection />}
            {activeTab === "instagram" && <InstagramSnapshotsSection />}
            {activeTab === "rsa" && <RsaSuggestionsSection />}
            {activeTab === "integrated" && <IntegratedInsightsSection />}
            {activeTab === "bids" && <BidAdjustmentsSection />}
            {activeTab === "editorial" && <EditorialCalendarSection />}
            {activeTab === "competition" && <CompetitionSection />}
            {activeTab === "searchterms" && <SearchTermsSection />}
            {activeTab === "autopause" && <AutoPauseSection />}
            {(activeTab === "auto1" || activeTab === "auto2" || activeTab === "auto3" || activeTab === "auto4" ||
              activeTab === "auto5" || activeTab === "auto6" || activeTab === "auto7" || activeTab === "auto8" ||
              activeTab === "auto9" || activeTab === "auto10" || activeTab === "auto11" || activeTab === "auto12" ||
              activeTab === "auto13") && <NewJobsSection jobId={activeTab} />}
          </CardContent>
        </Card>

        {/* Histórico de Execuções */}
        <ExecutionLogsPanel />

      </div>
    </>
  );
}
