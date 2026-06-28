import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { History, CheckCircle, AlertTriangle, AlertOctagon, Clock, Download, Calendar, Filter } from "lucide-react";

function severityLabel(severity: string) {
  if (severity === "critical") return { label: "Crítico", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };
  if (severity === "high") return { label: "Alto", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" };
  if (severity === "medium") return { label: "Médio", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" };
  return { label: "Baixo", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" };
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") return <AlertOctagon className="w-4 h-4 text-red-400 flex-shrink-0" />;
  if (severity === "high") return <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />;
  return <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
}

type PeriodPreset = "7d" | "14d" | "30d" | "custom";

function toISODate(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function ResolvedAlertsHistory() {
  const [preset, setPreset] = useState<PeriodPreset>("30d");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return toISODate(d);
  });
  const [customEnd, setCustomEnd] = useState(() => toISODate(new Date()));
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const { data: allAlerts, isLoading } = trpc.automations.getAnomalyAlerts.useQuery({ limit: 200, onlyUnresolved: false });

  const resolveAlert = trpc.automations.resolveAlert.useMutation({ onSuccess: () => {} });

  function formatDate(d: Date | string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const effectiveStart = useMemo(() => {
    if (preset === "custom") return new Date(customStart + "T00:00:00");
    const d = new Date();
    if (preset === "7d") d.setDate(d.getDate() - 7);
    else if (preset === "14d") d.setDate(d.getDate() - 14);
    else d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [preset, customStart]);

  const effectiveEnd = useMemo(() => {
    if (preset === "custom") return new Date(customEnd + "T23:59:59");
    const d = new Date(); d.setHours(23, 59, 59, 999); return d;
  }, [preset, customEnd]);

  const filteredAlerts = useMemo(() => {
    return (allAlerts ?? []).filter((a: any) => {
      const createdAt = new Date(a.createdAt);
      const inPeriod = createdAt >= effectiveStart && createdAt <= effectiveEnd;
      const matchesSeverity = severityFilter === "all" || a.severity === severityFilter;
      return inPeriod && matchesSeverity;
    });
  }, [allAlerts, effectiveStart, effectiveEnd, severityFilter]);

  const resolved = filteredAlerts.filter((a: any) => a.resolvedAt);
  const unresolved = filteredAlerts.filter((a: any) => !a.resolvedAt);

  function exportCSV() {
    const rows = filteredAlerts.map((a: any) => [
      a.resolvedAt ? "Resolvido" : "Pendente",
      severityLabel(a.severity).label,
      a.metric ?? "",
      (a.message ?? "").replace(/"/g, "'"),
      formatDate(a.createdAt),
      formatDate(a.resolvedAt),
    ]);
    const csv = [
      ["Status", "Severidade", "Métrica", "Mensagem", "Criado em", "Resolvido em"].join(","),
      ...rows.map(r => r.map(v => `"${v}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alertas-anomalia-${toISODate(new Date())}.csv`;
    a.click();
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <History className="w-4 h-4 text-blue-400" />
          Histórico de Alertas de Anomalia
          {unresolved.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
              {unresolved.length} pendente{unresolved.length > 1 ? "s" : ""}
            </span>
          )}
        </h2>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700/50 hover:bg-slate-700 rounded-lg border border-slate-600/50 text-slate-300 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <div className="flex gap-1 flex-wrap">
            {(["7d", "14d", "30d", "custom"] as PeriodPreset[]).map(p => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  preset === p
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-600/50 text-slate-400 hover:text-slate-300"
                }`}
              >
                {p === "custom" ? "Personalizado" : p === "7d" ? "7 dias" : p === "14d" ? "14 dias" : "30 dias"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:ml-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="text-xs bg-slate-700/50 border border-slate-600/50 rounded-lg px-2 py-1 text-slate-300 focus:outline-none"
          >
            <option value="all">Todas as severidades</option>
            <option value="critical">Crítico</option>
            <option value="high">Alto</option>
            <option value="medium">Médio</option>
            <option value="low">Baixo</option>
          </select>
        </div>
      </div>

      {/* Datas customizadas */}
      {preset === "custom" && (
        <div className="flex flex-col sm:flex-row gap-3 p-3 bg-slate-700/20 rounded-lg border border-slate-600/30">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">De:</label>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="text-xs bg-slate-700/50 border border-slate-600/50 rounded-lg px-2 py-1 text-slate-300 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Até:</label>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="text-xs bg-slate-700/50 border border-slate-600/50 rounded-lg px-2 py-1 text-slate-300 focus:outline-none"
            />
          </div>
          <p className="text-xs text-slate-500 self-center">
            {filteredAlerts.length} alerta{filteredAlerts.length !== 1 ? "s" : ""} no período
          </p>
        </div>
      )}

      {/* Conteúdo */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 rounded-lg bg-slate-700/30 animate-pulse" />
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Nenhum alerta no período selecionado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {unresolved.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Pendentes ({unresolved.length})</p>
              {unresolved.map((alert: any) => {
                const sev = severityLabel(alert.severity);
                return (
                  <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg border ${sev.bg} mb-2`}>
                    <SeverityIcon severity={alert.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold ${sev.color}`}>{sev.label}</span>
                        <span className="text-xs text-slate-400">{alert.metric}</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{formatDate(alert.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 mt-0.5 truncate">{alert.message}</p>
                    </div>
                    <button
                      onClick={() => resolveAlert.mutate({ id: alert.id })}
                      disabled={resolveAlert.isPending}
                      className="flex-shrink-0 px-2 py-1 text-xs rounded-lg border border-emerald-600/50 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                    >
                      Resolver
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {resolved.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Resolvidos ({resolved.length})</p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {resolved.map((alert: any) => {
                  const sev = severityLabel(alert.severity);
                  return (
                    <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-700/30 bg-slate-700/10">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-medium ${sev.color} opacity-70`}>{sev.label}</span>
                          <span className="text-xs text-slate-500">{alert.metric}</span>
                          <span className="text-xs text-slate-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{formatDate(alert.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mt-0.5 truncate">{alert.message}</p>
                        <p className="text-xs text-emerald-500 mt-0.5">
                          ✅ Resolvido em {formatDate(alert.resolvedAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
