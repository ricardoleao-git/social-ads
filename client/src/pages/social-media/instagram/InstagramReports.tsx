import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText, BarChart3, TrendingUp, FileSpreadsheet, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSocialMedia } from "@/components/social-media/SocialMediaWrapper";

interface Report {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  data: {
    period: string;
    followers: number;
    reach: number;
    engagement: number;
    posts: number;
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
  };
}

// Gera e baixa um arquivo CSV
function downloadCSV(report: Report, accountName: string) {
  const headers = ["Métrica", "Valor", "Período"];
  const rows = [
    ["Conta", accountName, report.data.period],
    ["Seguidores", report.data.followers.toString(), report.data.period],
    ["Alcance", report.data.reach.toString(), report.data.period],
    ["Impressões", report.data.impressions.toString(), report.data.period],
    ["Curtidas", report.data.likes.toString(), report.data.period],
    ["Comentários", report.data.comments.toString(), report.data.period],
    ["Compartilhamentos", report.data.shares.toString(), report.data.period],
    ["Posts", report.data.posts.toString(), report.data.period],
    ["Taxa de Engajamento (%)", report.data.engagement.toFixed(2), report.data.period],
  ];

  const csvContent = [
    headers.join(";"),
    ...rows.map((r) => r.join(";")),
  ].join("\n");

  const BOM = "\uFEFF"; // BOM para UTF-8 (Excel no Windows)
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-${report.id}-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Gera e baixa um PDF simples via HTML → window.print()
function downloadPDF(report: Report, accountName: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Relatório ${report.name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }
        h1 { color: #6d28d9; font-size: 24px; margin-bottom: 4px; }
        h2 { font-size: 16px; color: #555; margin-top: 0; }
        .meta { font-size: 13px; color: #888; margin-bottom: 32px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #6d28d9; color: white; padding: 10px 14px; text-align: left; font-size: 13px; }
        td { padding: 9px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        tr:nth-child(even) td { background: #f9fafb; }
        .footer { margin-top: 40px; font-size: 11px; color: #aaa; border-top: 1px solid #e5e7eb; padding-top: 12px; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <h1>${report.name}</h1>
      <h2>${accountName}</h2>
      <p class="meta">Período: ${report.data.period} &nbsp;|&nbsp; Gerado em: ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
      <table>
        <thead><tr><th>Métrica</th><th>Valor</th></tr></thead>
        <tbody>
          <tr><td>Seguidores</td><td>${report.data.followers.toLocaleString("pt-BR")}</td></tr>
          <tr><td>Alcance</td><td>${report.data.reach.toLocaleString("pt-BR")}</td></tr>
          <tr><td>Impressões</td><td>${report.data.impressions.toLocaleString("pt-BR")}</td></tr>
          <tr><td>Curtidas</td><td>${report.data.likes.toLocaleString("pt-BR")}</td></tr>
          <tr><td>Comentários</td><td>${report.data.comments.toLocaleString("pt-BR")}</td></tr>
          <tr><td>Compartilhamentos</td><td>${report.data.shares.toLocaleString("pt-BR")}</td></tr>
          <tr><td>Posts no Período</td><td>${report.data.posts}</td></tr>
          <tr><td>Taxa de Engajamento</td><td>${report.data.engagement.toFixed(2)}%</td></tr>
        </tbody>
      </table>
      <div class="footer">Relatório gerado automaticamente pelo InstaMetrics — Zênite Tech</div>
      <script>window.onload = () => { window.print(); }<\/script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export default function Reports() {
  const [, setLocation] = useLocation();
  const { selectedAccount } = useSocialMedia();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [downloadedPDF, setDownloadedPDF] = useState<string | null>(null);
  const [downloadedCSV, setDownloadedCSV] = useState<string | null>(null);

  const { data: liveData } = trpc.instagram.getLiveData.useQuery(
    { accountId: selectedAccount.id },
    { staleTime: 120_000, enabled: !!selectedAccount.id }
  );
  const { data: dbPosts } = trpc.instagram.getPosts.useQuery(
    { accountId: selectedAccount.id, limit: 50 },
    { staleTime: 120_000, enabled: !!selectedAccount.id }
  );

  const accountName = selectedAccount.displayName ?? selectedAccount.username ?? "Conta";
  const followers = (liveData as any)?.followers ?? (liveData as any)?.accountInfo?.followers ?? 0;
  const totalLikes = (dbPosts ?? []).reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalComments = (dbPosts ?? []).reduce((s, p) => s + (p.comments ?? 0), 0);
  const totalShares = (dbPosts ?? []).reduce((s, p) => s + (p.shares ?? 0), 0);
  const totalPosts = dbPosts?.length ?? 0;
  const avgEng = followers > 0 && totalPosts > 0
    ? parseFloat(((totalLikes + totalComments + totalShares) / totalPosts / followers * 100).toFixed(2))
    : 0;

  const reports: Report[] = [
    {
      id: "performance",
      name: "Relatório de Performance",
      description: "Análise completa de métricas e KPIs do período",
      icon: <BarChart3 className="w-6 h-6" />,
      color: "bg-blue-100 text-blue-700",
      data: {
        period: new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        followers,
        reach: (liveData as any)?.reach ?? 0,
        engagement: avgEng,
        posts: totalPosts,
        impressions: (liveData as any)?.impressions ?? 0,
        likes: totalLikes,
        comments: totalComments,
        shares: totalShares,
      },
    },
    {
      id: "growth",
      name: "Relatório de Crescimento",
      description: "Tendências e projeções de crescimento de seguidores",
      icon: <TrendingUp className="w-6 h-6" />,
      color: "bg-green-100 text-green-700",
      data: {
        period: "Último Trimestre",
        followers,
        reach: (liveData as any)?.reach ?? 0,
        engagement: avgEng,
        posts: totalPosts,
        impressions: (liveData as any)?.impressions ?? 0,
        likes: totalLikes,
        comments: totalComments,
        shares: totalShares,
      },
    },
    {
      id: "content",
      name: "Relatório de Conteúdo",
      description: "Análise de tipos de posts e performance por formato",
      icon: <FileText className="w-6 h-6" />,
      color: "bg-purple-100 text-purple-700",
      data: {
        period: "Último Mês",
        followers,
        reach: (liveData as any)?.reach ?? 0,
        engagement: avgEng,
        posts: totalPosts,
        impressions: (liveData as any)?.impressions ?? 0,
        likes: totalLikes,
        comments: totalComments,
        shares: totalShares,
      },
    },
  ];

  const handleDownloadPDF = (reportId: string) => {
    const report = reports.find((r) => r.id === reportId);
    if (report) {
      downloadPDF(report, accountName);
      setDownloadedPDF(reportId);
      setTimeout(() => setDownloadedPDF(null), 3000);
    }
  };

  const handleDownloadCSV = (reportId: string) => {
    const report = reports.find((r) => r.id === reportId);
    if (report) {
      downloadCSV(report, accountName);
      setDownloadedCSV(reportId);
      setTimeout(() => setDownloadedCSV(null), 3000);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setLocation("/redes-sociais")}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-gray-600">Gere e baixe relatórios detalhados em PDF ou CSV</p>
          </div>
        </div>

        {/* Cards de relatórios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {reports.map((report) => (
            <Card
              key={report.id}
              className={`p-6 border-0 shadow-sm cursor-pointer transition-all hover:shadow-lg ${
                selectedReport === report.id ? "ring-2 ring-purple-500" : ""
              }`}
              onClick={() => setSelectedReport(report.id)}
            >
              <div
                className={`w-12 h-12 rounded-lg ${report.color} flex items-center justify-center mb-4`}
              >
                {report.icon}
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{report.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{report.description}</p>

              {/* Botões de exportação */}
              <div className="flex gap-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadPDF(report.id);
                  }}
                  size="sm"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-foreground flex items-center justify-center gap-1.5"
                >
                  {downloadedPDF === report.id ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  PDF
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadCSV(report.id);
                  }}
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-foreground flex items-center justify-center gap-1.5"
                >
                  {downloadedCSV === report.id ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  CSV
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Pré-visualização do relatório selecionado */}
        {selectedReport && (
          <Card className="p-6 border-0 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">
                Pré-visualização —{" "}
                {reports.find((r) => r.id === selectedReport)?.name}
              </h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleDownloadPDF(selectedReport)}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50"
                >
                  <FileText className="w-4 h-4" />
                  Exportar PDF
                </Button>
                <Button
                  onClick={() => handleDownloadCSV(selectedReport)}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2 border-green-300 text-green-600 hover:bg-green-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar CSV
                </Button>
              </div>
            </div>

            {reports
              .filter((r) => r.id === selectedReport)
              .map((report) => (
                <div key={report.id} className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Período", value: report.data.period },
                      { label: "Seguidores", value: report.data.followers.toLocaleString("pt-BR") },
                      { label: "Alcance", value: report.data.reach.toLocaleString("pt-BR") },
                      { label: "Engajamento", value: `${report.data.engagement}%` },
                      { label: "Impressões", value: report.data.impressions.toLocaleString("pt-BR") },
                      { label: "Curtidas", value: report.data.likes.toLocaleString("pt-BR") },
                      { label: "Comentários", value: report.data.comments.toLocaleString("pt-BR") },
                      { label: "Posts", value: report.data.posts.toString() },
                    ].map((item) => (
                      <div key={item.label} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                        <p className="font-bold text-gray-900">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-900">
                      <span className="font-semibold">Resumo:</span> Este relatório contém
                      análises detalhadas sobre o desempenho da conta{" "}
                      <strong>{accountName}</strong> no período{" "}
                      <strong>{report.data.period}</strong>. Inclui métricas de crescimento,
                      engajamento e recomendações estratégicas.
                    </p>
                  </div>
                </div>
              ))}
          </Card>
        )}

        {/* Relatórios agendados */}
        <Card className="p-6 border-0 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">Relatórios Agendados</h3>
          <p className="text-sm text-gray-600 mb-4">
            Configure relatórios automáticos para serem enviados por e-mail
          </p>
          <div className="space-y-2">
            {[
              { label: "Relatório Semanal", desc: "Toda segunda-feira às 9h" },
              { label: "Relatório Mensal", desc: "Primeiro dia do mês às 9h" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-semibold text-gray-900">{item.label}</p>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
                <Button variant="outline" size="sm">
                  Ativar
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
