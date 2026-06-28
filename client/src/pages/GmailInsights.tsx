import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, AlertTriangle, Lightbulb, TrendingUp, Shield, Info, RefreshCw, CheckCircle, Clock } from "lucide-react";

interface GmailInsight {
  id: number;
  email_id: string;
  type: string;
  title: string;
  summary: string;
  action_required: boolean;
  priority: string;
  original_subject: string;
  original_date: string;
  processed_at: string;
  read_status: boolean;
}

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  recommendation: { icon: Lightbulb, color: "text-yellow-400", label: "Recomendação" },
  alert: { icon: AlertTriangle, color: "text-red-400", label: "Alerta" },
  performance: { icon: TrendingUp, color: "text-green-400", label: "Performance" },
  policy: { icon: Shield, color: "text-orange-400", label: "Política" },
  info: { icon: Info, color: "text-blue-400", label: "Informação" },
};

const priorityConfig: Record<string, { color: string; bgColor: string }> = {
  high: { color: "text-red-400", bgColor: "bg-red-500/20 border-red-500/30" },
  medium: { color: "text-yellow-400", bgColor: "bg-yellow-500/20 border-yellow-500/30" },
  low: { color: "text-gray-400", bgColor: "bg-gray-500/20 border-gray-500/30" },
};

export default function GmailInsights() {
  const [insights, setInsights] = useState<GmailInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [scanning, setScanning] = useState(false);

  const fetchInsights = async () => {
    try {
      const res = await fetch("/api/trpc/googleAds.getGmailInsights");
      const data = await res.json();
      const result = data?.result?.data?.json ?? data?.result?.data;
      if (result?.success) {
        setInsights(result.insights || []);
      } else {
        setError(result?.error || "Erro ao carregar insights");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const triggerScan = async () => {
    setScanning(true);
    try {
      await fetch("/api/trpc/googleAds.triggerGmailScan", { method: "GET" });
      // Wait a bit for processing then refresh
      setTimeout(() => {
        fetchInsights();
        setScanning(false);
      }, 5000);
    } catch {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-3 text-gray-400">Carregando insights do Gmail...</span>
      </div>
    );
  }

  const filtered = filterType === "all" ? insights : insights.filter(i => i.type === filterType);
  const typeCounts = insights.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const highPriority = insights.filter(i => i.priority === "high").length;
  const actionRequired = insights.filter(i => i.action_required).length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="w-7 h-7 text-blue-400" />
            Insights de E-mails Google Ads
          </h1>
          <p className="text-gray-400 mt-1">
            Leitura automática de e-mails do Google Ads com análise por IA — atualizado diariamente às 07:00 BRT
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={triggerScan}
          disabled={scanning}
          className="gap-2"
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {scanning ? "Escaneando..." : "Escanear agora"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400 uppercase">Total Insights</p>
            <p className="text-2xl font-bold text-white mt-1">{insights.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-950/30 border-red-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-red-400 uppercase">Alta Prioridade</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{highPriority}</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-950/30 border-yellow-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-yellow-400 uppercase">Ação Necessária</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{actionRequired}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-950/30 border-green-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-green-400 uppercase">Recomendações</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{typeCounts.recommendation || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={filterType === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterType("all")}>
          Todos ({insights.length})
        </Button>
        {Object.entries(typeConfig).map(([key, cfg]) => (
          <Button
            key={key}
            variant={filterType === key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType(key)}
          >
            {cfg.label} ({typeCounts[key] || 0})
          </Button>
        ))}
      </div>

      {/* Insights List */}
      {error ? (
        <Card className="border-amber-500/30 bg-amber-950/20">
          <CardContent className="p-6 text-center">
            <Mail className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-amber-400 font-medium">Nenhum insight disponível ainda</p>
            <p className="text-gray-400 text-sm mt-1">
              O job diário executará às 07:00 BRT ou clique em "Escanear agora" para processar manualmente.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-gray-400">Nenhum insight nesta categoria</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((insight) => {
            const cfg = typeConfig[insight.type] || typeConfig.info;
            const pCfg = priorityConfig[insight.priority] || priorityConfig.low;
            const Icon = cfg.icon;
            return (
              <Card key={insight.id} className={`${pCfg.bgColor} overflow-hidden`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 ${cfg.color} mt-0.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-white font-medium">{insight.title}</h3>
                        <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                        {insight.action_required && (
                          <Badge className="bg-red-600 text-white text-xs">Ação Necessária</Badge>
                        )}
                        <Badge variant="outline" className={`text-xs ${pCfg.color}`}>
                          {insight.priority === "high" ? "Alta" : insight.priority === "medium" ? "Média" : "Baixa"}
                        </Badge>
                      </div>
                      <p className="text-gray-300 text-sm">{insight.summary}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {insight.original_subject?.slice(0, 60)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(insight.processed_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
