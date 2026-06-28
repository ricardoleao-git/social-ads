import { useState, useMemo } from "react";
import {
  Activity,
  LogIn,
  LogOut,
  UserPlus,
  UserCog,
  UserX,
  Key,
  RefreshCw,
  Shield,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  BarChart2,
  AlertTriangle,
  Mail,
  TrendingUp,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { exportDataToPdf } from "@/lib/exportPdf";

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; color: string; chartColor: string }> = {
  login:           { label: "Login",           icon: <LogIn className="w-4 h-4" />,   color: "bg-green-100 text-green-700",   chartColor: "#22c55e" },
  logout:          { label: "Logout",          icon: <LogOut className="w-4 h-4" />,  color: "bg-gray-100 text-gray-600",    chartColor: "#94a3b8" },
  create_user:     { label: "Criar Usuário",   icon: <UserPlus className="w-4 h-4" />,color: "bg-blue-100 text-blue-700",    chartColor: "#3b82f6" },
  update_user:     { label: "Atualizar Usuário",icon: <UserCog className="w-4 h-4" />,color: "bg-yellow-100 text-yellow-700",chartColor: "#f59e0b" },
  delete_user:     { label: "Excluir Usuário", icon: <UserX className="w-4 h-4" />,   color: "bg-red-100 text-red-700",      chartColor: "#ef4444" },
  reset_password:  { label: "Redefinir Senha", icon: <Key className="w-4 h-4" />,     color: "bg-purple-100 text-purple-700",chartColor: "#a855f7" },
  change_password: { label: "Trocar Senha",    icon: <Key className="w-4 h-4" />,     color: "bg-indigo-100 text-indigo-700",chartColor: "#6366f1" },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? {
    label: action,
    icon: <Activity className="w-4 h-4" />,
    color: "bg-gray-100 text-gray-600",
    chartColor: "#94a3b8",
  };
}

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatDateShort(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const PAGE_SIZE = 20;

// Detect suspicious activity patterns
function detectSuspiciousActivity(logs: any[]) {
  const alerts: { type: string; description: string; severity: "high" | "medium" }[] = [];

  // Multiple failed logins from same IP in last hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentLogins = logs.filter(l => l.action === "login" && new Date(l.createdAt).getTime() > oneHourAgo);
  const ipLoginCounts: Record<string, number> = {};
  recentLogins.forEach(l => {
    if (l.ipAddress) ipLoginCounts[l.ipAddress] = (ipLoginCounts[l.ipAddress] || 0) + 1;
  });
  Object.entries(ipLoginCounts).forEach(([ip, count]) => {
    if (count >= 5) {
      alerts.push({ type: "Múltiplos Logins", description: `IP ${ip} realizou ${count} logins na última hora.`, severity: "high" });
    }
  });

  // Multiple user deletions in last 24h
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentDeletes = logs.filter(l => l.action === "delete_user" && new Date(l.createdAt).getTime() > oneDayAgo);
  if (recentDeletes.length >= 3) {
    alerts.push({ type: "Exclusões em Massa", description: `${recentDeletes.length} usuários excluídos nas últimas 24h.`, severity: "high" });
  }

  // Multiple password resets in last 24h
  const recentResets = logs.filter(l => l.action === "reset_password" && new Date(l.createdAt).getTime() > oneDayAgo);
  if (recentResets.length >= 5) {
    alerts.push({ type: "Resets de Senha em Massa", description: `${recentResets.length} resets de senha nas últimas 24h.`, severity: "medium" });
  }

  // Login from multiple different IPs for same user
  const userIpMap: Record<string, Set<string>> = {};
  recentLogins.forEach(l => {
    if (l.userEmail && l.ipAddress) {
      if (!userIpMap[l.userEmail]) userIpMap[l.userEmail] = new Set();
      userIpMap[l.userEmail].add(l.ipAddress);
    }
  });
  Object.entries(userIpMap).forEach(([email, ips]) => {
    if (ips.size >= 3) {
      alerts.push({ type: "Logins de Múltiplos IPs", description: `Usuário ${email} logou de ${ips.size} IPs diferentes na última hora.`, severity: "medium" });
    }
  });

  return alerts;
}

export default function ActivityLog() {
  const [, setLocation] = useLocation();
  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<"table" | "charts">("table");
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertSent, setAlertSent] = useState(false);

  const { data: logs = [], isLoading, refetch } = trpc.dashboardUsers.listActivityLogs.useQuery(
    { limit: 200 },
    { refetchInterval: 30_000 }
  );

  const sendAlertEmail = trpc.googleAds.sendPerformanceReport.useMutation();

  const filtered = useMemo(() => logs.filter((l) => {
    const matchAction = !filterAction || l.action === filterAction;
    const matchUser = !filterUser ||
      (l.userEmail ?? "").toLowerCase().includes(filterUser.toLowerCase()) ||
      (l.targetEmail ?? "").toLowerCase().includes(filterUser.toLowerCase());
    return matchAction && matchUser;
  }), [logs, filterAction, filterUser]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  // Chart data: activities per day (last 7 days)
  const activityByDay = useMemo(() => {
    const days: Record<string, Record<string, number>> = {};
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    logs
      .filter(l => new Date(l.createdAt).getTime() > sevenDaysAgo)
      .forEach(l => {
        const day = formatDateShort(l.createdAt);
        if (!days[day]) days[day] = {};
        days[day][l.action] = (days[day][l.action] || 0) + 1;
      });
    return Object.entries(days).map(([date, actions]) => ({ date, ...actions }));
  }, [logs]);

  // Chart data: activities by type (pie)
  const activityByType = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(l => { counts[l.action] = (counts[l.action] || 0) + 1; });
    return Object.entries(counts).map(([action, count]) => ({
      name: getActionMeta(action).label,
      value: count,
      color: getActionMeta(action).chartColor,
    }));
  }, [logs]);

  // Chart data: activities by user (top 5)
  const activityByUser = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(l => {
      const key = l.userEmail ?? "Desconhecido";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([email, count]) => ({ email: email.split("@")[0], count }));
  }, [logs]);

  const suspiciousAlerts = useMemo(() => detectSuspiciousActivity(logs), [logs]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ["Data/Hora", "Ação", "Usuário", "Alvo", "Descrição", "IP", "Status HTTP"];
    const rows = filtered.map(l => [
      formatDate(l.createdAt),
      getActionMeta(l.action).label,
      l.userEmail ?? "",
      l.targetEmail ?? "",
      l.description ?? "",
      l.ipAddress ?? "",
      l.statusCode?.toString() ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `log-atividades-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF
  const handleExportPDF = () => {
    const summaryRows = Object.entries(ACTION_META).map(([key, meta]) => ({
      label: meta.label,
      value: logs.filter(l => l.action === key).length.toString(),
    }));
    const logRows = filtered.slice(0, 100).map(l => ({
      label: `${formatDate(l.createdAt)} | ${getActionMeta(l.action).label} | ${l.userEmail ?? '—'}`,
      value: `${l.targetEmail ?? '—'} | ${(l.description ?? '').slice(0, 50)} | IP: ${l.ipAddress ?? '—'}`,
    }));
    exportDataToPdf({
      title: "Log de Atividades — Zênite Tech",
      subtitle: `Gerado em ${new Date().toLocaleString("pt-BR")} • ${filtered.length} registros`,
      filename: `log-atividades-${new Date().toISOString().split("T")[0]}.pdf`,
      sections: [
        {
          title: "Resumo por Tipo de Ação",
          rows: summaryRows,
        },
        {
          title: "Registros (primeiros 100)",
          rows: logRows,
        },
      ],
    });
  };

  // Send suspicious activity alert email
  const handleSendAlert = async () => {
    if (suspiciousAlerts.length === 0) return;
    setSendingAlert(true);
    try {
      const alertBody = suspiciousAlerts.map(a =>
        `⚠️ [${a.severity === "high" ? "ALTO" : "MÉDIO"}] ${a.type}: ${a.description}`
      ).join("\n");
      await sendAlertEmail.mutateAsync({
        to: "rjll70@gmail.com",
        period: "Alerta de Segurança",
        ctr: 0,
        clicks: 0,
        conversions: 0,
        cpc: 0,
        spend: 0,
        impressions: 0,
      });
      setAlertSent(true);
      setTimeout(() => setAlertSent(false), 5000);
    } catch (e) {
      console.error("Erro ao enviar alerta:", e);
    } finally {
      setSendingAlert(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setLocation("/admin/users")}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Usuários
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-semibold">Log de Atividades</h1>
          </div>
          <span className="text-xs text-muted-foreground">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <RefreshCw className="w-4 h-4" /> Atualizar
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-lg text-sm"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-foreground rounded-lg text-sm"
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mt-4">
          <button
            onClick={() => setActiveTab("table")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "table" ? "bg-blue-600 text-foreground" : "text-muted-foreground hover:bg-secondary/50"
            }`}
          >
            <Activity className="w-4 h-4" /> Registros
          </button>
          <button
            onClick={() => setActiveTab("charts")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "charts" ? "bg-blue-600 text-foreground" : "text-muted-foreground hover:bg-secondary/50"
            }`}
          >
            <BarChart2 className="w-4 h-4" /> Gráficos
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Suspicious Activity Alerts */}
        {suspiciousAlerts.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                    {suspiciousAlerts.length} Atividade{suspiciousAlerts.length > 1 ? "s" : ""} Suspeita{suspiciousAlerts.length > 1 ? "s" : ""} Detectada{suspiciousAlerts.length > 1 ? "s" : ""}
                  </h3>
                  <ul className="space-y-1">
                    {suspiciousAlerts.map((alert, i) => (
                      <li key={i} className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          alert.severity === "high" ? "bg-red-200 text-red-800" : "bg-orange-100 text-orange-700"
                        }`}>
                          {alert.severity === "high" ? "ALTO" : "MÉDIO"}
                        </span>
                        <strong>{alert.type}:</strong> {alert.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <button
                onClick={handleSendAlert}
                disabled={sendingAlert || alertSent}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium shrink-0 transition-colors ${
                  alertSent
                    ? "bg-green-600 text-foreground"
                    : "bg-red-600 hover:bg-red-700 text-foreground"
                }`}
              >
                <Mail className="w-4 h-4" />
                {sendingAlert ? "Enviando..." : alertSent ? "Enviado!" : "Enviar Alerta por E-mail"}
              </button>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(ACTION_META).slice(0, 4).map(([key, meta]) => {
            const count = logs.filter((l) => l.action === key).length;
            return (
              <div key={key} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
                <span className={`p-2 rounded-lg ${meta.color}`}>{meta.icon}</span>
                <div>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                  <p className="text-xl font-bold">{count}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* TABLE TAB */}
        {activeTab === "table" && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
                className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas as ações</option>
                {uniqueActions.map((a) => (
                  <option key={a} value={a}>{getActionMeta(a).label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Filtrar por e-mail..."
                value={filterUser}
                onChange={(e) => { setFilterUser(e.target.value); setPage(0); }}
                className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Carregando logs...</div>
              ) : paginated.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhum registro encontrado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data/Hora</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Ação</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Usuário</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Alvo</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Descrição</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((log) => {
                        const meta = getActionMeta(log.action);
                        return (
                          <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/20">
                            <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                              {formatDate(log.createdAt)}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.color}`}>
                                {meta.icon}
                                {meta.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm">{log.userEmail ?? "—"}</td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">{log.targetEmail ?? "—"}</td>
                            <td className="py-3 px-4 text-sm max-w-xs truncate" title={log.description ?? ""}>
                              {log.description ?? "—"}
                            </td>
                            <td className="py-3 px-4 text-xs text-muted-foreground">{log.ipAddress ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Página {page + 1} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 border border-border rounded-lg text-sm disabled:opacity-40 hover:bg-secondary/30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className="px-3 py-1.5 border border-border rounded-lg text-sm disabled:opacity-40 hover:bg-secondary/30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* CHARTS TAB */}
        {activeTab === "charts" && (
          <div className="space-y-6">
            {/* Activities per day */}
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold">Atividades por Dia — Últimos 7 Dias</h2>
              </div>
              {activityByDay.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados suficientes para exibir o gráfico.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={activityByDay} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    />
                    <Legend />
                    {Object.keys(ACTION_META).map(key => (
                      <Bar key={key} dataKey={key} name={ACTION_META[key].label} fill={ACTION_META[key].chartColor} stackId="a" />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Activities by type + by user side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pie chart: by type */}
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="w-5 h-5 text-blue-600" />
                  <h2 className="font-semibold">Distribuição por Tipo de Ação</h2>
                </div>
                {activityByType.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                    Sem dados.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={activityByType}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {activityByType.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Bar chart: by user */}
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <UserCog className="w-5 h-5 text-blue-600" />
                  <h2 className="font-semibold">Top 5 Usuários Mais Ativos</h2>
                </div>
                {activityByUser.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                    Sem dados.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={activityByUser} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="email" type="category" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      />
                      <Bar dataKey="count" name="Ações" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* All action counts */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="font-semibold mb-4">Resumo Completo por Tipo de Ação</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Object.entries(ACTION_META).map(([key, meta]) => {
                  const count = logs.filter(l => l.action === key).length;
                  return (
                    <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                      <span className={`p-1.5 rounded-lg ${meta.color}`}>{meta.icon}</span>
                      <div>
                        <p className="text-xs text-muted-foreground">{meta.label}</p>
                        <p className="text-lg font-bold">{count}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
