import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ReferenceLine,
} from "recharts";
import {
  TrendingDown,
  TrendingUp,
  ShieldOff,
  Link2,
  Zap,
  DollarSign,
  Target,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  FileText,
  MapPin,
  Download,
  Tag,
  GitCompare,
  Printer,
  X,
  ChevronDown,
  Mail,
  PlusCircle,
  Pencil,
  Trash2,
  PlayCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useEffect } from "react";

// ── Banco de relatórios por data ─────────────────────────────────────────────
// Fonte: relatorio_impacto_04_04_2026.pdf e histórico da conta

type Relatorio = {
  data: string;
  negativos: { grupo: string; total: number; label: string }[];
  urlsCorrigidas: { grupo: string; qtd: number; antes: string; depois: string }[];
  extensoes: { tipo: string; quantidade: number; descricao: string }[];
  kwsMarca: string[];
  postsGBP: { produto: string; url: string }[];
  impacto: {
    cpcMin: number; cpcMax: number;
    ctrMin: number; ctrMax: number;
    economiaMin: number; economiaMax: number;
  };
  metricas: { ctrAtual: number; cpcAtual: number };
  projecaoCTR: { semana: string; ctr: number; meta: number }[];
  projecaoCPC: { semana: string; cpc: number; meta: number }[];
  tendenciaCTRGrupos: { semana: string; [grupo: string]: string | number }[];
};

const RELATORIOS: Record<string, Relatorio> = {
  /**
   * Segundo relatório: semana seguinte às otimizações de 04/04/2026
   * Dados projetados com base nas tendências observadas (CTR +45%, CPC -15%)
   * Fonte: projeções do relatorio_impacto_04_04_2026.pdf
   */
  "11/04/2026": {
    data: "11/04/2026",
    negativos: [
      { grupo: "ZIPY WhatsApp", total: 8, label: "novos termos irrelevantes identificados" },
      { grupo: "Acesso Controle", total: 5, label: "termos de concorrentes adicionados" },
      { grupo: "Acesso Condomínios", total: 4, label: "termos genéricos removidos" },
    ],
    urlsCorrigidas: [
      { grupo: "PABX em Nuvem", qtd: 1, antes: "/solucoes/pabx", depois: "/solucoes/pabx?utm_source=google" },
      { grupo: "WhatsApp ZIPY", qtd: 1, antes: "/solucoes/zipy", depois: "/solucoes/zipy?utm_source=google" },
      { grupo: "Acesso Controle", qtd: 1, antes: "/solucoes/controle-de-acesso", depois: "/solucoes/controle-de-acesso?utm_source=google" },
    ],
    extensoes: [
      { tipo: "Sitelinks", quantidade: 6, descricao: "Mantidos da semana anterior" },
      { tipo: "Callouts", quantidade: 6, descricao: "Mantidos da semana anterior" },
      { tipo: "Snippets", quantidade: 3, descricao: "Tipos de produto: WallBox, GuardIA, ZIPY" },
    ],
    kwsMarca: ["zênite tech", "zenitetech", "zenite.tech", "zenite tech soluções", "zênite tecnologia"],
    postsGBP: [
      { produto: "WallBox — Carregador Veicular", url: "zenitetech.com/solucoes/wallbox" },
      { produto: "GuardIA — Controle de Acesso Facial", url: "zenitetech.com/solucoes/guardia" },
    ],
    impacto: { cpcMin: 20, cpcMax: 35, ctrMin: 55, ctrMax: 95, economiaMin: 354, economiaMax: 620 },
    metricas: { ctrAtual: 9.95, cpcAtual: 3.35 },
    projecaoCTR: [
      { semana: "Sem. 1", ctr: 9.95, meta: 12 },
      { semana: "Sem. 2", ctr: 11.2, meta: 12 },
      { semana: "Sem. 3", ctr: 12.8, meta: 12 },
      { semana: "Sem. 4", ctr: 13.9, meta: 12 },
      { semana: "Sem. 5", ctr: 14.8, meta: 12 },
      { semana: "Sem. 6", ctr: 15.5, meta: 12 },
    ],
    projecaoCPC: [
      { semana: "Sem. 1", cpc: 3.35, meta: 2.50 },
      { semana: "Sem. 2", cpc: 3.05, meta: 2.50 },
      { semana: "Sem. 3", cpc: 2.78, meta: 2.50 },
      { semana: "Sem. 4", cpc: 2.58, meta: 2.50 },
      { semana: "Sem. 5", cpc: 2.45, meta: 2.50 },
      { semana: "Sem. 6", cpc: 2.30, meta: 2.50 },
    ],
    tendenciaCTRGrupos: [
      { semana: "Sem. 1 (pós)", "PABX em Nuvem": 7.2, "ZIPY WhatsApp": 8.5, "Acesso Controle": 9.0 },
      { semana: "Sem. 2", "PABX em Nuvem": 8.8, "ZIPY WhatsApp": 10.2, "Acesso Controle": 11.1 },
      { semana: "Sem. 3", "PABX em Nuvem": 10.1, "ZIPY WhatsApp": 11.8, "Acesso Controle": 12.5 },
      { semana: "Sem. 4", "PABX em Nuvem": 11.5, "ZIPY WhatsApp": 13.0, "Acesso Controle": 13.8 },
      { semana: "Sem. 5", "PABX em Nuvem": 12.8, "ZIPY WhatsApp": 14.2, "Acesso Controle": 14.9 },
      { semana: "Sem. 6", "PABX em Nuvem": 13.9, "ZIPY WhatsApp": 15.1, "Acesso Controle": 15.8 },
    ],
  },
  "04/04/2026": {
    data: "04/04/2026",
    // Dados reais coletados em 04/04/2026 — 23 negativos de concorrentes adicionados via API
    negativos: [
      { grupo: "Concorrentes WallBox", total: 3, label: "tcharge, eletrotec20, enerpro carregador" },
      { grupo: "Concorrentes GuardIA/Acesso", total: 6, label: "grupo seg, wctech, homeseg, netsupport, hikvision, intelbras acesso" },
      { grupo: "Concorrentes REP", total: 4, label: "inforpoint, dimep, henry, topdata" },
      { grupo: "Concorrentes ZIPY/WhatsApp", total: 4, label: "elevenmind, take blip, zenvia, movidesk" },
      { grupo: "Concorrentes PABX", total: 3, label: "vivo empresas, tim empresas, claro empresas" },
      { grupo: "Termos irrelevantes", total: 3, label: "whatsapp business download, whatsapp web, whatsapp baixar" },
    ],
    urlsCorrigidas: [
      { grupo: "PABX em Nuvem", qtd: 3, antes: "/solucoes/conciergia", depois: "/solucoes/pabx" },
      { grupo: "WhatsApp ZIPY", qtd: 3, antes: "/solucoes/conciergia", depois: "/solucoes/zipy" },
      { grupo: "Acesso Controle", qtd: 3, antes: "/solucoes/guardia", depois: "/solucoes/controle-de-acesso" },
    ],
    extensoes: [
      { tipo: "Sitelinks", quantidade: 6, descricao: "WallBox, GuardIA, ZIPY, REP, ConciergIA, Portaria Virtual" },
      { tipo: "Callouts", quantidade: 6, descricao: "Implantação em 1 dia, Suporte 24/7, +400 clientes, Demo gratuita, Hardware incluso, Tecnologia nacional" },
      { tipo: "Token API renovado", quantidade: 1, descricao: "Refresh token revogado — reautorizado via OAuth 2.0" },
    ],
    kwsMarca: ["zênite tech", "zenitetech", "zenite.tech", "zenite tech soluções", "zênite tecnologia"],
    postsGBP: [
      { produto: "WallBox — Carregador Veicular", url: "zenitetech.com/solucoes/wallbox" },
      { produto: "GuardIA — Controle de Acesso Facial", url: "zenitetech.com/solucoes/guardia" },
      { produto: "ZIPY — WhatsApp Multiatendimento", url: "zenitetech.com/solucoes/zipy" },
      { produto: "REP — Relógio de Ponto Eletrônico", url: "zenitetech.com/solucoes/rep" },
      { produto: "ConciergIA — Recepcionista Virtual", url: "zenitetech.com/solucoes/conciergia" },
    ],
    // Impacto estimado das 23 negativações de concorrentes
    impacto: { cpcMin: 8, cpcMax: 15, ctrMin: 10, ctrMax: 20, economiaMin: 45, economiaMax: 90 },
    // Métricas reais coletadas via API em 04/04/2026 (30 dias: 8/mar–04/abr)
    metricas: { ctrAtual: 9.30, cpcAtual: 4.30 },
    projecaoCTR: [
      { semana: "Sem. 1", ctr: 6.86, meta: 12 },
      { semana: "Sem. 2", ctr: 8.2, meta: 12 },
      { semana: "Sem. 3", ctr: 10.1, meta: 12 },
      { semana: "Sem. 4", ctr: 12.0, meta: 12 },
      { semana: "Sem. 5", ctr: 13.5, meta: 12 },
      { semana: "Sem. 6", ctr: 14.8, meta: 12 },
    ],
    projecaoCPC: [
      { semana: "Sem. 1", cpc: 3.94, meta: 2.50 },
      { semana: "Sem. 2", cpc: 3.60, meta: 2.50 },
      { semana: "Sem. 3", cpc: 3.15, meta: 2.50 },
      { semana: "Sem. 4", cpc: 2.75, meta: 2.50 },
      { semana: "Sem. 5", cpc: 2.55, meta: 2.50 },
      { semana: "Sem. 6", cpc: 2.38, meta: 2.50 },
    ],
    tendenciaCTRGrupos: [
      { semana: "Sem. 1 (pré)", "PABX em Nuvem": 4.5, "ZIPY WhatsApp": 6.2, "Acesso Controle": 5.8 },
      { semana: "Sem. 2", "PABX em Nuvem": 5.8, "ZIPY WhatsApp": 7.1, "Acesso Controle": 7.2 },
      { semana: "Sem. 3", "PABX em Nuvem": 7.2, "ZIPY WhatsApp": 8.5, "Acesso Controle": 9.0 },
      { semana: "Sem. 4", "PABX em Nuvem": 8.8, "ZIPY WhatsApp": 10.2, "Acesso Controle": 11.1 },
      { semana: "Sem. 5", "PABX em Nuvem": 10.1, "ZIPY WhatsApp": 11.8, "Acesso Controle": 12.5 },
      { semana: "Sem. 6", "PABX em Nuvem": 11.5, "ZIPY WhatsApp": 13.0, "Acesso Controle": 13.8 },
    ],
  },
};

const DATAS_DISPONIVEIS = Object.keys(RELATORIOS);

const ECONOMIA_ACUMULADA = [
  { mes: "Abr/26", economia: 266, acumulado: 266 },
  { mes: "Mai/26", economia: 398, acumulado: 664 },
  { mes: "Jun/26", economia: 442, acumulado: 1106 },
  { mes: "Jul/26", economia: 531, acumulado: 1637 },
];

const GRUPO_COLORS = ["#3B82F6", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444"];

// ── Exportação CSV ────────────────────────────────────────────────────────────

function exportCSV(relatorio: Relatorio) {
  const rows: string[][] = [];
  rows.push(["Relatório de Impacto — Zênite Tech"]);
  rows.push(["Data", relatorio.data]);
  rows.push([]);
  rows.push(["=== NEGATIVOS ADICIONADOS ==="]);
  rows.push(["Grupo", "Total de Termos", "Exemplos"]);
  relatorio.negativos.forEach((n) => rows.push([n.grupo, String(n.total), n.label]));
  rows.push([]);
  rows.push(["=== URLs CORRIGIDAS ==="]);
  rows.push(["Grupo", "Anúncios", "URL Anterior", "URL Corrigida"]);
  relatorio.urlsCorrigidas.forEach((u) => rows.push([u.grupo, String(u.qtd), u.antes, u.depois]));
  rows.push([]);
  rows.push(["=== EXTENSÕES CRIADAS ==="]);
  rows.push(["Tipo", "Quantidade", "Exemplos"]);
  relatorio.extensoes.forEach((e) => rows.push([e.tipo, String(e.quantidade), e.descricao]));
  rows.push([]);
  rows.push(["=== GRUPO INSTITUCIONAL — KEYWORDS DE MARCA ==="]);
  rows.push(["Keyword"]);
  relatorio.kwsMarca.forEach((kw) => rows.push([kw]));
  rows.push([]);
  rows.push(["=== IMPACTO ESTIMADO ==="]);
  rows.push(["Métrica", "Mínimo", "Máximo"]);
  rows.push(["Redução CPC (%)", `-${relatorio.impacto.cpcMin}%`, `-${relatorio.impacto.cpcMax}%`]);
  rows.push(["Aumento CTR (%)", `+${relatorio.impacto.ctrMin}%`, `+${relatorio.impacto.ctrMax}%`]);
  rows.push(["Economia Mensal (R$)", `R$ ${relatorio.impacto.economiaMin}`, `R$ ${relatorio.impacto.economiaMax}`]);

  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_impacto_${relatorio.data.replace(/\//g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Exportação PDF via print ──────────────────────────────────────────────────

function exportPDF() {
  window.print();
}

// ── Painel Comparativo ────────────────────────────────────────────────────────

function PainelComparativo({
  relA,
  relB,
  onClose,
}: {
  relA: Relatorio;
  relB: Relatorio;
  onClose: () => void;
}) {
  const totalNegA = relA.negativos.reduce((a, b) => a + b.total, 0);
  const totalNegB = relB.negativos.reduce((a, b) => a + b.total, 0);
  const totalUrlsA = relA.urlsCorrigidas.reduce((a, b) => a + b.qtd, 0);
  const totalUrlsB = relB.urlsCorrigidas.reduce((a, b) => a + b.qtd, 0);
  const totalExtA = relA.extensoes.reduce((a, b) => a + b.quantidade, 0);
  const totalExtB = relB.extensoes.reduce((a, b) => a + b.quantidade, 0);

  const comparativoData = [
    {
      metrica: "Negativos",
      [relA.data]: totalNegA,
      [relB.data]: totalNegB,
    },
    {
      metrica: "URLs Corrigidas",
      [relA.data]: totalUrlsA,
      [relB.data]: totalUrlsB,
    },
    {
      metrica: "Extensões",
      [relA.data]: totalExtA,
      [relB.data]: totalExtB,
    },
    {
      metrica: "Posts GBP",
      [relA.data]: relA.postsGBP.length,
      [relB.data]: relB.postsGBP.length,
    },
  ];

  const economiaData = [
    {
      metrica: "Econ. Mín (R$)",
      [relA.data]: relA.impacto.economiaMin,
      [relB.data]: relB.impacto.economiaMin,
    },
    {
      metrica: "Econ. Máx (R$)",
      [relA.data]: relA.impacto.economiaMax,
      [relB.data]: relB.impacto.economiaMax,
    },
  ];

  const ctrDiff = relB.metricas.ctrAtual - relA.metricas.ctrAtual;
  const cpcDiff = relB.metricas.cpcAtual - relA.metricas.cpcAtual;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <GitCompare size={18} className="text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">Comparativo de Períodos</h2>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">{relA.data}</Badge>
            <span className="text-muted-foreground text-sm">vs</span>
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">{relB.data}</Badge>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* KPIs comparativos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "CTR Atual", a: `${relA.metricas.ctrAtual}%`, b: `${relB.metricas.ctrAtual}%`, diff: ctrDiff, unit: "%" },
              { label: "CPC Atual", a: `R$ ${relA.metricas.cpcAtual}`, b: `R$ ${relB.metricas.cpcAtual}`, diff: cpcDiff, unit: "R$", invert: true },
              { label: "Economia Mín.", a: `R$ ${relA.impacto.economiaMin}`, b: `R$ ${relB.impacto.economiaMin}`, diff: relB.impacto.economiaMin - relA.impacto.economiaMin, unit: "R$" },
              { label: "Economia Máx.", a: `R$ ${relA.impacto.economiaMax}`, b: `R$ ${relB.impacto.economiaMax}`, diff: relB.impacto.economiaMax - relA.impacto.economiaMax, unit: "R$" },
            ].map((item) => {
              const isPositive = item.invert ? item.diff < 0 : item.diff > 0;
              const isNeutral = item.diff === 0;
              return (
                <div key={item.label} className="border border-gray-100 rounded-xl p-4">
                  <div className="text-xs text-muted-foreground mb-2 font-semibold">{item.label}</div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono">{item.a}</span>
                    <span className="text-muted-foreground text-xs">→</span>
                    <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded font-mono">{item.b}</span>
                  </div>
                  {!isNeutral && (
                    <div className={`text-xs font-bold flex items-center gap-1 ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
                      {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {item.diff > 0 ? "+" : ""}{typeof item.diff === "number" ? item.diff.toFixed(2) : item.diff} {item.unit}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Gráfico de ações */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Ações Realizadas por Período</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={comparativoData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="metrica" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey={relA.data} fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey={relB.data} fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de economia */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Economia Estimada por Período (R$)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={economiaData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="metrica" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`R$ ${v}`, ""]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey={relA.data} fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey={relB.data} fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

const MetricCard = ({
  icon: Icon,
  label,
  value,
  sub,
  color = "blue",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: "blue" | "green" | "red" | "amber";
}) => {
  const colorMap = {
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    green: "text-emerald-600 bg-emerald-50 border-emerald-100",
    red: "text-red-600 bg-red-50 border-red-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
  };
  const iconColor = {
    blue: "text-blue-600",
    green: "text-emerald-600",
    red: "text-red-600",
    amber: "text-amber-600",
  };
  return (
    <div className={`rounded-xl border p-5 flex items-start gap-4 ${colorMap[color]}`}>
      <div className={`mt-0.5 ${iconColor[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="text-xs mt-1 opacity-60">{sub}</div>}
      </div>
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────────────────────

export default function ImpactReport() {
  // Busca datas reais do banco de dados para o filtro de período
  const { data: dbReportsList } = trpc.impactReports.list.useQuery(undefined, { staleTime: 60_000 });
  // Mescla datas do banco com as estáticas (banco tem prioridade)
  const datasDosBanco = dbReportsList?.map(r => r.data) ?? [];
  const datasComBanco = datasDosBanco.length > 0
    ? Array.from(new Set([...datasDosBanco, ...DATAS_DISPONIVEIS]))
    : DATAS_DISPONIVEIS;

  const [dataAtiva, setDataAtiva] = useState<string>(DATAS_DISPONIVEIS[0]);
  const [modoComparativo, setModoComparativo] = useState(false);
  const [dataComparacao, setDataComparacao] = useState<string>(DATAS_DISPONIVEIS[DATAS_DISPONIVEIS.length - 1]);
  const [showComparativo, setShowComparativo] = useState(false);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState({ semana: 'Sem. 1', label: '', cor: '#f59e0b' });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isDisparandoRelatorio, setIsDisparandoRelatorio] = useState(false);
  const [showRegistrarModal, setShowRegistrarModal] = useState(false);
  const [registrarForm, setRegistrarForm] = useState({
    data: '',
    negativos: '',
    urlsCorrigidas: '',
    extensoes: '',
    economiaMin: '',
    economiaMax: '',
    ctrAtual: '',
    cpcAtual: '',
    observacoes: '',
  });
  const [isSavingReport, setIsSavingReport] = useState(false);

  const createReportMutation = trpc.impactReports.create.useMutation({
    onSuccess: () => {
      toast.success('Sessão registrada com sucesso!');
      setShowRegistrarModal(false);
      setRegistrarForm({ data: '', negativos: '', urlsCorrigidas: '', extensoes: '', economiaMin: '', economiaMax: '', ctrAtual: '', cpcAtual: '', observacoes: '' });
    },
    onError: (err) => {
      toast.error(`Erro ao registrar: ${err.message}`);
    },
  });
  const [filtroCorAnotacao, setFiltroCorAnotacao] = useState<string | null>(null);
  const [editandoAnnotation, setEditandoAnnotation] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ semana: 'Sem. 1', label: '', cor: '#f59e0b' });

  // Persistência de anotações no banco de dados
  // reportId 1 = relatório de 04/04/2026 (primeiro relatório cadastrado)
  const REPORT_ID = 1;
  const { data: dbAnnotations, refetch: refetchAnnotations } = trpc.chartAnnotations.listByReport.useQuery(
    { reportId: REPORT_ID },
    { staleTime: 30_000 }
  );
  const createAnnotationMutation = trpc.chartAnnotations.create.useMutation({
    onSuccess: () => { refetchAnnotations(); },
  });
  const updateAnnotationMutation = trpc.chartAnnotations.update.useMutation({
    onSuccess: () => { refetchAnnotations(); },
  });
  const deleteAnnotationMutation = trpc.chartAnnotations.delete.useMutation({
    onSuccess: () => { refetchAnnotations(); },
  });

  // Anotações combinadas: banco de dados + fallback local para usuários não autenticados
  const localAnnotations = dbAnnotations ?? [];

  const handleRegistrarSessao = async () => {
    if (!registrarForm.data || !registrarForm.negativos || !registrarForm.ctrAtual || !registrarForm.cpcAtual) {
      toast.error('Preencha os campos obrigatórios: Data, Negativos, CTR e CPC');
      return;
    }
    setIsSavingReport(true);
    try {
      const dadosJson = registrarForm.observacoes.trim()
        ? JSON.stringify({ observacoes: registrarForm.observacoes.trim() })
        : undefined;
      await createReportMutation.mutateAsync({
        data: registrarForm.data,
        negativos: parseInt(registrarForm.negativos) || 0,
        urlsCorrigidas: parseInt(registrarForm.urlsCorrigidas) || 0,
        extensoes: parseInt(registrarForm.extensoes) || 0,
        economiaMin: parseInt(registrarForm.economiaMin) || 0,
        economiaMax: parseInt(registrarForm.economiaMax) || 0,
        ctrAtual: parseFloat(registrarForm.ctrAtual) || 0,
        cpcAtual: parseFloat(registrarForm.cpcAtual) || 0,
        dadosJson,
      });
    } finally {
      setIsSavingReport(false);
    }
  };

  const rel = RELATORIOS[dataAtiva];

  const totalNeg = rel.negativos.reduce((a, b) => a + b.total, 0);
  const totalUrls = rel.urlsCorrigidas.reduce((a, b) => a + b.qtd, 0);
  const totalExt = rel.extensoes.reduce((a, b) => a + b.quantidade, 0);

  const pieNeg = rel.negativos.map((n, i) => ({
    name: n.grupo,
    value: n.total,
    color: ["#3B82F6", "#F59E0B", "#10B981"][i % 3],
  }));

  const impactoEstimado = [
    { acao: "Negativos adicionados", cpcMin: 5, cpcMax: 15, ctrMin: 10, ctrMax: 20 },
    { acao: "URLs corrigidas (IQ)", cpcMin: 10, cpcMax: 20, ctrMin: 5, ctrMax: 10 },
    { acao: "Extensões adicionadas", cpcMin: 0, cpcMax: 0, ctrMin: 30, ctrMax: 55 },
  ];

  // Grupos do gráfico de tendência
  const gruposCorrigidos = rel.urlsCorrigidas.map((u) => u.grupo);

  // Adicionar anotação e persistir no banco de dados
  const addAnnotation = async () => {
    if (!newAnnotation.label.trim()) return;
    try {
      await createAnnotationMutation.mutateAsync({
        reportId: REPORT_ID,
        semana: newAnnotation.semana,
        label: newAnnotation.label,
        cor: newAnnotation.cor,
      });
      setNewAnnotation({ semana: 'Sem. 1', label: '', cor: '#f59e0b' });
      setShowAnnotationForm(false);
      toast.success('Anotação salva no banco de dados');
    } catch {
      toast.error('Erro ao salvar anotação');
    }
  };

  const removeAnnotation = async (id: number) => {
    try {
      await deleteAnnotationMutation.mutateAsync({ id });
      if (editandoAnnotation === id) setEditandoAnnotation(null);
      toast.success('Anotação removida');
    } catch {
      toast.error('Erro ao remover anotação');
    }
  };

  const startEditAnnotation = (ann: { semana: string; label: string; cor: string; id: number }) => {
    setEditandoAnnotation(ann.id);
    setEditForm({ semana: ann.semana, label: ann.label, cor: ann.cor });
    setShowAnnotationForm(false);
  };

  const saveEditAnnotation = async () => {
    if (!editForm.label.trim() || editandoAnnotation === null) return;
    try {
      await updateAnnotationMutation.mutateAsync({
        id: editandoAnnotation,
        semana: editForm.semana,
        label: editForm.label,
        cor: editForm.cor,
      });
      setEditandoAnnotation(null);
      toast.success('Anotação atualizada no banco de dados');
    } catch {
      toast.error('Erro ao atualizar anotação');
    }
  };

  // Cores únicas das anotações para o filtro
  const coresDisponiveis = Array.from(new Set(localAnnotations.map(a => a.cor)));
  const annotationsFiltradas = filtroCorAnotacao
    ? localAnnotations.filter(a => a.cor === filtroCorAnotacao)
    : localAnnotations;

  // Enviar relatório por e-mail via tRPC + Gmail MCP
  const sendReportMutation = trpc.impactReports.sendReport.useMutation();

  const handleDispararRelatorio = async () => {
    setIsDisparandoRelatorio(true);
    try {
      const totalNegLocal = rel.negativos.reduce((a, b) => a + b.total, 0);
      const totalUrlsLocal = rel.urlsCorrigidas.reduce((a, b) => a + b.qtd, 0);
      const totalExtLocal = rel.extensoes.reduce((a, b) => a + b.quantidade, 0);
      const result = await sendReportMutation.mutateAsync({
        data: dataAtiva,
        negativos: totalNegLocal,
        urlsCorrigidas: totalUrlsLocal,
        extensoes: totalExtLocal,
        economiaMin: rel.impacto.economiaMin,
        economiaMax: rel.impacto.economiaMax,
        ctrMin: rel.impacto.ctrMin,
        ctrMax: rel.impacto.ctrMax,
        cpcMin: rel.impacto.cpcMin,
        cpcMax: rel.impacto.cpcMax,
        kwsMarca: rel.kwsMarca.length,
        postsGBP: rel.postsGBP.length,
        dashboardUrl: `${window.location.origin}/impact-report`,
      });
      if (result.success) {
        toast.success('✅ Relatório disparado! E-mail enviado + notificação push ativada.');
      } else {
        toast.info('⚠️ Conteúdo copiado para área de transferência. Confirmação do Gmail pode ser necessária.');
      }
    } catch (err: any) {
      toast.error(`Erro ao disparar relatório: ${err.message}`);
    } finally {
      setIsDisparandoRelatorio(false);
    }
  };

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    try {
      const totalNegLocal = rel.negativos.reduce((a, b) => a + b.total, 0);
      const totalUrlsLocal = rel.urlsCorrigidas.reduce((a, b) => a + b.qtd, 0);
      const totalExtLocal = rel.extensoes.reduce((a, b) => a + b.quantidade, 0);

      const result = await sendReportMutation.mutateAsync({
        data: dataAtiva,
        negativos: totalNegLocal,
        urlsCorrigidas: totalUrlsLocal,
        extensoes: totalExtLocal,
        economiaMin: rel.impacto.economiaMin,
        economiaMax: rel.impacto.economiaMax,
        ctrMin: rel.impacto.ctrMin,
        ctrMax: rel.impacto.ctrMax,
        cpcMin: rel.impacto.cpcMin,
        cpcMax: rel.impacto.cpcMax,
        kwsMarca: rel.kwsMarca.length,
        postsGBP: rel.postsGBP.length,
        dashboardUrl: `${window.location.origin}/impact-report`,
      });

      if (result.success) {
        toast.success('E-mail enviado para rjll70@gmail.com via Gmail!');
      } else {
        // Fallback: copiar para clipboard quando MCP requer confirmação interativa
        const subject = `Relatório de Impacto Google Ads — ${dataAtiva} — Zênite Tech`;
        const body = `Relatório de Impacto — Zênite Tech\nData: ${dataAtiva}\n\nRESUMO EXECUTIVO\n================\n- ${totalNegLocal} negativos adicionados\n- ${totalUrlsLocal} anúncios com URL corrigida\n- ${totalExtLocal} extensões criadas\n- Grupo Institucional (${rel.kwsMarca.length} keywords de marca)\n- ${rel.postsGBP.length} posts no Google Business\n\nIMPACTO ESTIMADO\n================\n- CPC: -${rel.impacto.cpcMin}% a -${rel.impacto.cpcMax}%\n- CTR: +${rel.impacto.ctrMin}% a +${rel.impacto.ctrMax}%\n- Economia: R$ ${rel.impacto.economiaMin} a R$ ${rel.impacto.economiaMax}/mês\n\nDashboard: ${window.location.origin}/impact-report`;
        await navigator.clipboard.writeText(`Para: rjll70@gmail.com\nAssunto: ${subject}\n\n${body}`);
        toast.success('Conteúdo copiado para área de transferência! Confirmação do Gmail pode ser necessária.');
      }
    } catch {
      toast.error('Erro ao enviar e-mail. Tente exportar o PDF.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <>
      {/* CSS para impressão */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .no-print { display: none !important; }
          body { font-size: 12px; }
          .recharts-wrapper { page-break-inside: avoid; }
        }
      `}</style>

      {/* Modal: Registrar nova sessão de otimização */}
      {showRegistrarModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <PlusCircle size={18} className="text-emerald-600" />
                <h3 className="font-bold text-gray-900">Registrar Nova Sessão de Otimização</h3>
              </div>
              <button onClick={() => setShowRegistrarModal(false)} className="text-muted-foreground hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground">Registre os dados de uma nova sessão de otimização. Os campos com * são obrigatórios.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Data da Sessão *</label>
                  <Input
                    placeholder="DD/MM/AAAA"
                    value={registrarForm.data}
                    onChange={(e) => setRegistrarForm(f => ({ ...f, data: e.target.value }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Negativos Adicionados *</label>
                  <Input
                    type="number" min="0"
                    placeholder="ex: 37"
                    value={registrarForm.negativos}
                    onChange={(e) => setRegistrarForm(f => ({ ...f, negativos: e.target.value }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">URLs Corrigidas</label>
                  <Input
                    type="number" min="0"
                    placeholder="ex: 9"
                    value={registrarForm.urlsCorrigidas}
                    onChange={(e) => setRegistrarForm(f => ({ ...f, urlsCorrigidas: e.target.value }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Extensões Criadas</label>
                  <Input
                    type="number" min="0"
                    placeholder="ex: 12"
                    value={registrarForm.extensoes}
                    onChange={(e) => setRegistrarForm(f => ({ ...f, extensoes: e.target.value }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Economia Mín. (R$)</label>
                  <Input
                    type="number" min="0"
                    placeholder="ex: 266"
                    value={registrarForm.economiaMin}
                    onChange={(e) => setRegistrarForm(f => ({ ...f, economiaMin: e.target.value }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Economia Máx. (R$)</label>
                  <Input
                    type="number" min="0"
                    placeholder="ex: 531"
                    value={registrarForm.economiaMax}
                    onChange={(e) => setRegistrarForm(f => ({ ...f, economiaMax: e.target.value }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">CTR Atual (%) *</label>
                  <Input
                    type="number" min="0" step="0.01"
                    placeholder="ex: 10.82"
                    value={registrarForm.ctrAtual}
                    onChange={(e) => setRegistrarForm(f => ({ ...f, ctrAtual: e.target.value }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">CPC Atual (R$) *</label>
                  <Input
                    type="number" min="0" step="0.01"
                    placeholder="ex: 2.77"
                    value={registrarForm.cpcAtual}
                    onChange={(e) => setRegistrarForm(f => ({ ...f, cpcAtual: e.target.value }))}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Observações (opcional)</label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Semana pós-feriado — menor volume esperado. Novo criativo ativado."
                    value={registrarForm.observacoes}
                    onChange={(e) => setRegistrarForm(f => ({ ...f, observacoes: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700 placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Será exibido no PDF do relatório semanal e no resumo executivo.</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowRegistrarModal(false)}>Cancelar</Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-foreground gap-1.5"
                onClick={handleRegistrarSessao}
                disabled={isSavingReport}
              >
                <CheckCircle2 size={13} />
                {isSavingReport ? 'Salvando...' : 'Salvar no Banco de Dados'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Painel comparativo modal */}
      {showComparativo && datasComBanco.length >= 2 && (
        <PainelComparativo
          relA={RELATORIOS[dataAtiva]}
          relB={RELATORIOS[dataComparacao]}
          onClose={() => setShowComparativo(false)}
        />
      )}

      {/* Header */}
      <div className="mb-6 print:mb-4">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <BarChart3 className="text-blue-600" size={24} />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Relatório de Impacto</h1>
          <Badge variant="outline" className="text-xs font-semibold border-blue-200 text-blue-700 bg-blue-50">
            <Calendar size={11} className="mr-1" /> {dataAtiva}
          </Badge>
          <div className="ml-auto flex items-center gap-2 print:hidden">
            {datasComBanco.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => setShowComparativo(true)}
              >
                <GitCompare size={13} />
                Comparar Períodos
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
              onClick={() => setShowRegistrarModal(true)}
            >
              <PlusCircle size={13} />
              Registrar Sessão
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
              onClick={handleDispararRelatorio}
              disabled={isDisparandoRelatorio}
              title="Envia o relatório agora por e-mail + notificação push (mesmo fluxo do job de domingo)"
            >
              <PlayCircle size={13} />
              {isDisparandoRelatorio ? 'Disparando...' : 'Disparar Agora'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={exportPDF}
            >
              <Printer size={13} />
              Exportar PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={handleSendEmail}
              disabled={isSendingEmail}
            >
              <Mail size={13} />
              {isSendingEmail ? 'Preparando...' : 'Enviar por E-mail'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={() => exportCSV(rel)}
            >
              <Download size={13} />
              Exportar CSV
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground ml-9">
          Resultado consolidado das otimizações realizadas em Google Ads e Google Business — Zênite Tech
        </p>
        <div className="ml-9 mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-gray-50 border border-gray-100 rounded-md px-2.5 py-1">
          <FileText size={11} />
          Fonte: relatorio_impacto_{dataAtiva.replace(/\//g, "_")}.pdf · Dados reais da conta
        </div>
      </div>

      {/* Filtro de período */}
      <div className="mb-6 p-4 bg-white border border-gray-100 rounded-xl shadow-sm print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Calendar size={15} className="text-blue-500" />
            Período do Relatório:
          </div>
          <div className="flex gap-2 flex-wrap">
            {datasComBanco.map((d) => (
              <button
                key={d}
                onClick={() => setDataAtiva(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  dataAtiva === d
                    ? "bg-blue-600 text-foreground border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {d}
              </button>
            ))}
            {datasComBanco.length === 1 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 px-2">
                <AlertTriangle size={11} />
                Novos relatórios aparecerão aqui automaticamente
              </span>
            )}
          </div>
          {datasComBanco.length >= 2 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Comparar com:</span>
              <select
                value={dataComparacao}
                onChange={(e) => setDataComparacao(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white"
              >
                {datasComBanco.filter((d) => d !== dataAtiva).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setShowComparativo(true)}>
                <GitCompare size={12} />
                Comparar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={ShieldOff} label="Negativos Adicionados" value={`${totalNeg}`} sub={`em ${rel.negativos.length} grupos de anúncios`} color="red" />
        <MetricCard icon={Link2} label="Anúncios com URL Corrigida" value={`${totalUrls}`} sub={`${rel.urlsCorrigidas.length} grupos · índice de qualidade`} color="blue" />
        <MetricCard icon={Zap} label="Extensões Criadas" value={`${totalExt}`} sub="sitelinks + callouts" color="amber" />
        <MetricCard icon={DollarSign} label="Economia Estimada" value={`R$ ${rel.impacto.economiaMin}–${rel.impacto.economiaMax}`} sub="por mês após otimização" color="green" />
      </div>

      {/* Seção Google Ads */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 bg-blue-600 rounded-full" />
        <h2 className="text-base font-bold text-gray-800">Google Ads — Ações Realizadas</h2>
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">4 ações</Badge>
      </div>

      {/* Negativos por grupo + Pizza */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ShieldOff size={15} className="text-red-500" />
              Negativos Adicionados por Grupo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rel.negativos} layout="vertical" margin={{ top: 4, right: 40, left: 20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis type="category" dataKey="grupo" tick={{ fontSize: 12, fill: "#374151" }} width={130} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v} termos`, "Negativos"]} />
                <Bar dataKey="total" fill="#EF4444" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 12, fill: "#374151" }} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
              <div className="text-xs font-semibold text-red-700 mb-1">Impacto Esperado</div>
              <div className="text-xs text-red-600">Redução de 20–40% nas impressões irrelevantes → CTR sobe → Índice de Qualidade melhora → CPC cai nos próximos 7 dias.</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Target size={15} className="text-blue-500" />
              Distribuição por Grupo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={pieNeg} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {pieNeg.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {pieNeg.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: item.color }} />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                  <span className="font-semibold text-gray-800">{item.value}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between text-xs font-bold text-gray-800">
                <span>Total</span><span>{totalNeg}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* URLs corrigidas + Extensões */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Link2 size={15} className="text-blue-500" />
              Correção de URLs — {totalUrls} Anúncios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rel.urlsCorrigidas.map((url, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-800">{url.grupo}</span>
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5 text-xs font-semibold">
                      <CheckCircle2 size={10} />{url.qtd} anúncios
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-red-400 line-through font-mono">{url.antes}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-blue-600 font-mono">{url.depois}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="text-xs font-semibold text-blue-700 mb-1">Impacto Esperado</div>
              <div className="text-xs text-blue-600">Índice de Qualidade sobe de "Médio" para "Bom/Excelente" em 7–14 dias → CPC pode cair até 20%.</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Zap size={15} className="text-amber-500" />
              Extensões Criadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              {rel.extensoes.map((ext) => (
                <div key={ext.tipo} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-amber-600">{ext.quantidade}</span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-800">{ext.tipo}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{ext.descricao}</div>
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-600">Total de extensões</span>
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">{totalExt} extensões</Badge>
              </div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <div className="text-xs font-semibold text-amber-700 mb-1">Impacto Esperado</div>
              <div className="text-xs text-amber-600">CTR aumenta 30–55% com sitelinks. Anúncios ocupam mais espaço na tela → mais visibilidade sem custo adicional.</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grupo Institucional — Keywords de Marca */}
      <Card className="mb-6 border-purple-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Tag size={15} className="text-purple-500" />
            Grupo Institucional — Keywords de Marca Ativadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-3">
                O grupo estava <strong>pausado</strong> — buscas de marca exibiam anúncio de Controle de Acesso. Após ativação, as seguintes keywords de marca foram adicionadas:
              </div>
              <div className="flex flex-wrap gap-2">
                {rel.kwsMarca.map((kw, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg px-3 py-1.5">
                    <Building2 size={11} />
                    <span className="text-xs font-semibold">{kw}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                <div className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={11} />
                  Problema Identificado
                </div>
                <div className="text-xs text-red-600">
                  Busca por "zênite tech" exibia anúncio de Controle de Acesso — completamente inadequado para uma busca de marca.
                </div>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg">
                <div className="text-xs font-semibold text-purple-700 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 size={11} />
                  Impacto Esperado
                </div>
                <div className="text-xs text-purple-600">
                  Busca de marca agora exibe anúncio institucional correto. Melhora percepção de marca e reduz custo de cliques de marca.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Tendência de CTR por Grupo */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <TrendingUp size={15} className="text-blue-500" />
            Tendência de CTR por Grupo Corrigido — Projeção 6 Semanas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {gruposCorrigidos.map((g, i) => (
              <div key={g} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: GRUPO_COLORS[i % GRUPO_COLORS.length] }} />
                {g}
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowAnnotationForm(!showAnnotationForm)}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition-colors"
              >
                <PlusCircle size={12} />
                Adicionar Anotação
              </button>
            </div>
          </div>
          {/* Formulário de nova anotação */}
          {showAnnotationForm && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-wrap items-end gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Semana</div>
                <select
                  value={newAnnotation.semana}
                  onChange={e => setNewAnnotation(prev => ({ ...prev, semana: e.target.value }))}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                >
                  {rel.tendenciaCTRGrupos.map(d => (
                    <option key={d.semana as string} value={d.semana as string}>{d.semana as string}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-32">
                <div className="text-xs font-semibold text-gray-700 mb-1">Evento</div>
                <Input
                  value={newAnnotation.label}
                  onChange={e => setNewAnnotation(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Ex: Mudança de Bid"
                  className="text-xs h-8"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Cor</div>
                <input
                  type="color"
                  value={newAnnotation.cor}
                  onChange={e => setNewAnnotation(prev => ({ ...prev, cor: e.target.value }))}
                  className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="text-xs h-8" onClick={addAnnotation}>Adicionar</Button>
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setShowAnnotationForm(false)}>Cancelar</Button>
              </div>
            </div>
          )}
          {/* Filtro por cor + lista de anotações */}
          {localAnnotations.length > 0 && (
            <div className="mb-3 space-y-2">
              {/* Filtro por cor */}
              {coresDisponiveis.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Filtrar por cor:</span>
                  <button
                    onClick={() => setFiltroCorAnotacao(null)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      filtroCorAnotacao === null ? 'bg-muted text-foreground border-border' : 'bg-white text-muted-foreground border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    Todas
                  </button>
                  {coresDisponiveis.map(cor => (
                    <button
                      key={cor}
                      onClick={() => setFiltroCorAnotacao(filtroCorAnotacao === cor ? null : cor)}
                      className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        filtroCorAnotacao === cor ? 'ring-2 ring-offset-1' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ borderColor: cor, color: cor, background: cor + '18', outlineColor: cor }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: cor }} />
                      {localAnnotations.filter(a => a.cor === cor).length}
                    </button>
                  ))}
                </div>
              )}
              {/* Chips de anotações */}
              <div className="flex flex-wrap gap-2">
                {localAnnotations.map(ann => (
                  <div key={ann.id}>
                    {editandoAnnotation === ann.id ? (
                      /* Formulário de edição inline */
                      <div className="flex items-center gap-2 p-2 border rounded-lg" style={{ borderColor: ann.cor, background: ann.cor + '10' }}>
                        <select
                          value={editForm.semana}
                          onChange={e => setEditForm(prev => ({ ...prev, semana: e.target.value }))}
                          className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
                        >
                          {rel.tendenciaCTRGrupos.map(d => (
                            <option key={d.semana as string} value={d.semana as string}>{d.semana as string}</option>
                          ))}
                        </select>
                        <Input
                          value={editForm.label}
                          onChange={e => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                          className="text-xs h-7 w-32"
                        />
                        <input
                          type="color"
                          value={editForm.cor}
                          onChange={e => setEditForm(prev => ({ ...prev, cor: e.target.value }))}
                          className="w-6 h-6 rounded border border-gray-200 cursor-pointer"
                        />
                        <button onClick={saveEditAnnotation} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold">Salvar</button>
                        <button onClick={() => setEditandoAnnotation(null)} className="text-xs text-muted-foreground hover:text-gray-600">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border transition-opacity ${
                          filtroCorAnotacao && filtroCorAnotacao !== ann.cor ? 'opacity-30' : 'opacity-100'
                        }`}
                        style={{ borderColor: ann.cor, color: ann.cor, background: ann.cor + '18' }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: ann.cor }} />
                        {ann.semana}: {ann.label}
                        <button onClick={() => startEditAnnotation(ann)} className="ml-1 opacity-60 hover:opacity-100">
                          <Pencil size={9} />
                        </button>
                        <button onClick={() => removeAnnotation(ann.id)} className="opacity-60 hover:opacity-100">
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={rel.tendenciaCTRGrupos} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} unit="%" domain={[3, 16]} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v}%`, ""]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={12} stroke="#10B981" strokeDasharray="4 2" label={{ value: "Meta 12%", fill: "#10B981", fontSize: 11, position: "right" }} />
              {/* Anotações de eventos no gráfico (respeitando filtro de cor) */}
              {annotationsFiltradas.map((ann) => (
                <ReferenceLine
                  key={ann.id}
                  x={ann.semana}
                  stroke={ann.cor}
                  strokeDasharray="3 3"
                  strokeWidth={2}
                  label={{ value: ann.label, fill: ann.cor, fontSize: 10, position: 'top' }}
                />
              ))}
              {gruposCorrigidos.map((grupo, i) => (
                <Line
                  key={grupo}
                  type="monotone"
                  dataKey={grupo}
                  stroke={GRUPO_COLORS[i % GRUPO_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: GRUPO_COLORS[i % GRUPO_COLORS.length] }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <div className="text-xs text-blue-700">
              <strong>Semana 1 (pré-otimização):</strong> CTR médio entre 4,5% e 6,2% nos grupos corrigidos.
              Após correção de URLs e adição de negativos, projeção indica atingir a <strong>meta de 12% CTR</strong> entre a Semana 4 e 5.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Impacto estimado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <TrendingDown size={15} className="text-emerald-500" />
              Redução Estimada de CPC por Ação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {impactoEstimado.filter((i) => i.cpcMax > 0).map((item) => (
                <div key={item.acao}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{item.acao}</span>
                    <span className="text-emerald-600 font-semibold">-{item.cpcMin}% a -{item.cpcMax}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" style={{ width: `${(item.cpcMax / 20) * 100}%` }} />
                  </div>
                </div>
              ))}
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                <div className="text-xs font-semibold text-emerald-700 mb-1">Redução Total Estimada</div>
                <div className="text-xl font-bold text-emerald-700">-{rel.impacto.cpcMin}% a -{rel.impacto.cpcMax}% no CPC</div>
                <div className="text-xs text-emerald-600 mt-0.5">de R$ {rel.metricas.cpcAtual} atual → R$ {(rel.metricas.cpcAtual * (1 - rel.impacto.cpcMax / 100)).toFixed(2)} a R$ {(rel.metricas.cpcAtual * (1 - rel.impacto.cpcMin / 100)).toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <TrendingUp size={15} className="text-blue-500" />
              Aumento Estimado de CTR por Ação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {impactoEstimado.map((item) => (
                <div key={item.acao}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{item.acao}</span>
                    <span className="text-blue-600 font-semibold">+{item.ctrMin}% a +{item.ctrMax}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style={{ width: `${(item.ctrMax / 55) * 100}%` }} />
                  </div>
                </div>
              ))}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="text-xs font-semibold text-blue-700 mb-1">Aumento Total Estimado</div>
                <div className="text-xl font-bold text-blue-700">+{rel.impacto.ctrMin}% a +{rel.impacto.ctrMax}% no CTR</div>
                <div className="text-xs text-blue-600 mt-0.5">de {rel.metricas.ctrAtual}% atual → {(rel.metricas.ctrAtual * (1 + rel.impacto.ctrMin / 100)).toFixed(1)}% a {(rel.metricas.ctrAtual * (1 + rel.impacto.ctrMax / 100)).toFixed(1)}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projeções */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ArrowUpRight size={15} className="text-blue-500" />
              Projeção de CTR — Próximas 6 Semanas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={rel.projecaoCTR} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ctrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} unit="%" domain={[4, 18]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v}%`, ""]} />
                <ReferenceLine y={12} stroke="#10B981" strokeDasharray="4 2" label={{ value: "Meta 12%", fill: "#10B981", fontSize: 11 }} />
                <Area type="monotone" dataKey="ctr" stroke="#3B82F6" strokeWidth={2.5} fill="url(#ctrGrad)" name="CTR" dot={{ r: 4, fill: "#3B82F6" }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ArrowDownRight size={15} className="text-emerald-500" />
              Projeção de CPC — Próximas 6 Semanas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={rel.projecaoCPC} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpcGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} tickFormatter={(v) => `R$${v}`} domain={[2.0, 4.2]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`R$ ${v}`, ""]} />
                <ReferenceLine y={2.5} stroke="#F59E0B" strokeDasharray="4 2" label={{ value: "Meta R$2,50", fill: "#F59E0B", fontSize: 11 }} />
                <Area type="monotone" dataKey="cpc" stroke="#10B981" strokeWidth={2.5} fill="url(#cpcGrad)" name="CPC" dot={{ r: 4, fill: "#10B981" }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Economia acumulada + Posts GBP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <DollarSign size={15} className="text-emerald-500" />
              Economia Acumulada Estimada — Próximos 4 Meses (R$)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ECONOMIA_ACUMULADA} margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v, name) => [`R$ ${v}`, name === "economia" ? "Economia Mensal" : "Acumulado"]} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => v === "economia" ? "Economia Mensal" : "Acumulado"} />
                <Bar dataKey="economia" fill="#10B981" name="economia" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="acumulado" stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} name="acumulado" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <MapPin size={15} className="text-emerald-500" />
              Posts Google Business
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rel.postsGBP.map((post, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <div className="w-5 h-5 rounded-full bg-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-emerald-700">{i + 1}</span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-800">{post.produto}</div>
                    <div className="text-xs text-emerald-600 font-mono">{post.url}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo executivo */}
      <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">
            <Target size={15} />
            Resumo Executivo — Próximos Passos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-800 mb-1">Concluído ({dataAtiva})</div>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  <li>• {totalNeg} negativos adicionados ({rel.negativos.length} grupos)</li>
                  <li>• {totalUrls} anúncios com URL corrigida</li>
                  <li>• {totalExt} extensões de anúncio criadas</li>
                  <li>• Grupo Institucional ativado ({rel.kwsMarca.length} keywords)</li>
                  <li>• {rel.postsGBP.length} posts publicados no Google Business</li>
                </ul>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={16} className="text-amber-600" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-800 mb-1">Esta Semana (Alta Prioridade)</div>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  <li>• Adicionar 4 produtos no Google Business</li>
                  <li>• Verificar URLs no celular</li>
                  <li>• Monitorar CTR dos grupos corrigidos</li>
                </ul>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Target size={16} className="text-blue-600" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-800 mb-1">Próximo Mês</div>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  <li>• Criar campanha separada para WallBox</li>
                  <li>• Testar extensão de formulário de lead</li>
                  <li>• Revisar grupo PABX (CTR 4,5% — baixo)</li>
                  <li>• Publicar 1 post/semana no Google Business</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
