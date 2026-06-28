/**
 * Página: Documentos e Downloads
 * Lista documentos disponíveis para download com links diretos (sem incorporar PDFs).
 * Inclui: favoritos, busca com highlight, recentes, contador de downloads, barra de progresso, mais acessados.
 */
import { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import {
  FileText, Download, ExternalLink, Search, Filter,
  FileBarChart, FileSpreadsheet, BookOpen, Lightbulb,
  Calendar, Eye, ArrowDownToLine, Star, TrendingUp, Clock,
  Sparkles,
} from "lucide-react";

interface Documento {
  id: string;
  titulo: string;
  descricao: string;
  categoria: "relatorio" | "planejamento" | "guia" | "planilha";
  tamanho: string;
  dataUpload: string;
  dataTimestamp: number; // para ordenar por recência
  url: string;
  tipo: "PDF" | "XLSX" | "DOCX" | "CSV";
  downloadsIniciais: number;
}

const DOCUMENTOS: Documento[] = [
  {
    id: "plano-estrategico",
    titulo: "Plano Estratégico — Zênite Tech",
    descricao: "Planejamento estratégico completo com metas, indicadores e roadmap de crescimento da Zênite Tech.",
    categoria: "planejamento",
    tamanho: "354 KB",
    dataUpload: "07/04/2026",
    dataTimestamp: new Date("2026-04-07").getTime(),
    url: "https://d2xsxph8kpxj0f.cloudfront.net/106210929/F9wbEsJhUoBfairbvN3R4D/plano_estrategico_d40958c5.pdf",
    tipo: "PDF",
    downloadsIniciais: 14,
  },
  {
    id: "relatorio-impacto",
    titulo: "Relatório de Impacto — Otimizações Google Ads",
    descricao: "Relatório detalhado das otimizações realizadas: negativos, URLs corrigidas, extensões e economia estimada.",
    categoria: "relatorio",
    tamanho: "Gerado dinamicamente",
    dataUpload: "04/04/2026",
    dataTimestamp: new Date("2026-04-04").getTime(),
    url: "/impact-report",
    tipo: "PDF",
    downloadsIniciais: 32,
  },
  {
    id: "guia-rsa",
    titulo: "Guia de RSA Optimizer",
    descricao: "Instruções e melhores práticas para otimização de Anúncios de Pesquisa Responsivos (RSA) no Google Ads.",
    categoria: "guia",
    tamanho: "—",
    dataUpload: "01/04/2026",
    dataTimestamp: new Date("2026-04-01").getTime(),
    url: "/rsa-optimizer",
    tipo: "PDF",
    downloadsIniciais: 8,
  },
  {
    id: "negativos-export",
    titulo: "Exportação de Palavras Negativas",
    descricao: "Lista completa de palavras-chave negativas configuradas nas campanhas, exportável em CSV ou PDF.",
    categoria: "planilha",
    tamanho: "Gerado dinamicamente",
    dataUpload: "Atual",
    dataTimestamp: new Date("2026-04-07").getTime(),
    url: "/negative-keywords",
    tipo: "CSV",
    downloadsIniciais: 21,
  },
];

const CATEGORIA_LABELS: Record<Documento["categoria"], string> = {
  relatorio: "Relatório",
  planejamento: "Planejamento",
  guia: "Guia",
  planilha: "Planilha",
};

const CATEGORIA_COLORS: Record<Documento["categoria"], string> = {
  relatorio: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  planejamento: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  guia: "bg-green-500/20 text-green-400 border-green-500/30",
  planilha: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const CATEGORIA_ICONS: Record<Documento["categoria"], React.ElementType> = {
  relatorio: FileBarChart,
  planejamento: BookOpen,
  guia: Lightbulb,
  planilha: FileSpreadsheet,
};

const TIPO_COLORS: Record<string, string> = {
  PDF: "bg-red-500/20 text-red-400",
  XLSX: "bg-green-500/20 text-green-400",
  DOCX: "bg-blue-500/20 text-blue-400",
  CSV: "bg-yellow-500/20 text-yellow-400",
};

// ─── Highlight de texto ───────────────────────────────────────────────────────
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-400/30 text-yellow-300 rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ─── Barra de progresso ───────────────────────────────────────────────────────
function DownloadProgress({ progress }: { progress: number }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-blue-400 font-medium">Preparando download...</span>
        <span className="text-xs text-muted-foreground">{progress}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ─── Card de documento ────────────────────────────────────────────────────────
function DocumentoCard({
  doc,
  downloads,
  isFavorito,
  onDownload,
  onToggleFavorito,
  busca,
}: {
  doc: Documento;
  downloads: number;
  isFavorito: boolean;
  onDownload: (id: string, url: string) => void;
  onToggleFavorito: (id: string) => void;
  busca: string;
}) {
  const Icon = CATEGORIA_ICONS[doc.categoria];
  const isExternal = doc.url.startsWith("http");
  const [progress, setProgress] = useState<number | null>(null);

  const handleDownload = useCallback(() => {
    if (progress !== null) return;
    onDownload(doc.id, doc.url);
    if (isExternal) {
      setProgress(0);
      const steps = [10, 25, 45, 65, 80, 92, 100];
      let i = 0;
      const interval = setInterval(() => {
        setProgress(steps[i]);
        i++;
        if (i >= steps.length) {
          clearInterval(interval);
          setTimeout(() => setProgress(null), 800);
        }
      }, 220);
    }
  }, [doc.id, doc.url, isExternal, onDownload, progress]);

  return (
    <div className={`bg-card border rounded-xl p-5 transition-colors ${isFavorito ? "border-yellow-500/40 hover:border-yellow-500/60" : "border-border hover:border-border"}`}>
      <div className="flex items-start gap-4">
        {/* Ícone */}
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-blue-400" />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-foreground font-semibold text-sm leading-tight">
                <HighlightText text={doc.titulo} query={busca} />
              </h3>
              <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                <HighlightText text={doc.descricao} query={busca} />
              </p>
            </div>
            {/* Botão favoritar */}
            <button
              onClick={() => onToggleFavorito(doc.id)}
              title={isFavorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                isFavorito
                  ? "text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20"
                  : "text-gray-600 hover:text-yellow-400 hover:bg-yellow-500/10"
              }`}
            >
              <Star className={`w-4 h-4 ${isFavorito ? "fill-yellow-400" : ""}`} />
            </button>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${CATEGORIA_COLORS[doc.categoria]}`}>
              {CATEGORIA_LABELS[doc.categoria]}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${TIPO_COLORS[doc.tipo] ?? "bg-gray-700 text-muted-foreground"}`}>
              {doc.tipo}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              <Calendar className="w-3 h-3" />
              {doc.dataUpload}
            </span>
            {doc.tamanho !== "—" && doc.tamanho !== "Gerado dinamicamente" && (
              <span className="text-muted-foreground text-xs">{doc.tamanho}</span>
            )}
            <span className="flex items-center gap-1 text-muted-foreground text-xs ml-auto">
              <Download className="w-3 h-3" />
              {downloads} download{downloads !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Barra de progresso */}
          {progress !== null && <DownloadProgress progress={progress} />}

          {/* Ações */}
          <div className="flex items-center gap-2 mt-4">
            {isExternal ? (
              <>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" download onClick={handleDownload}>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-foreground h-8 text-xs gap-1.5"
                    disabled={progress !== null && progress < 100}
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    {progress !== null && progress < 100 ? "Baixando..." : `Baixar ${doc.tipo}`}
                  </Button>
                </a>
                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="border-border text-muted-foreground hover:text-foreground h-8 text-xs gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    Visualizar
                  </Button>
                </a>
              </>
            ) : (
              <a href={doc.url} onClick={() => onDownload(doc.id, doc.url)}>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-foreground h-8 text-xs gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Acessar página
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Documentos() {
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");
  const [mostrarFavoritos, setMostrarFavoritos] = useState(false);

  const [downloadCounts, setDownloadCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(DOCUMENTOS.map(d => [d.id, d.downloadsIniciais]))
  );

  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());

  const handleDownload = useCallback((id: string, _url: string) => {
    setDownloadCounts(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  const handleToggleFavorito = useCallback((id: string) => {
    setFavoritos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Documentos adicionados recentemente (top 2 por dataTimestamp)
  const recentes = useMemo(
    () => [...DOCUMENTOS].sort((a, b) => b.dataTimestamp - a.dataTimestamp).slice(0, 2),
    []
  );

  // Top 3 mais acessados
  const maisAcessados = useMemo(
    () => [...DOCUMENTOS].sort((a, b) => (downloadCounts[b.id] ?? 0) - (downloadCounts[a.id] ?? 0)).slice(0, 3),
    [downloadCounts]
  );

  const documentosFiltrados = useMemo(() => {
    return DOCUMENTOS.filter(doc => {
      const matchBusca =
        busca === "" ||
        doc.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        doc.descricao.toLowerCase().includes(busca.toLowerCase());
      const matchCategoria = filtroCategoria === "todos" || doc.categoria === filtroCategoria;
      const matchFavorito = !mostrarFavoritos || favoritos.has(doc.id);
      return matchBusca && matchCategoria && matchFavorito;
    });
  }, [busca, filtroCategoria, mostrarFavoritos, favoritos]);

  const categorias = ["todos", ...Array.from(new Set(DOCUMENTOS.map(d => d.categoria)))];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-400" />
              Documentos e Downloads
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Acesse relatórios, planos estratégicos, guias e planilhas da Zênite Tech
            </p>
          </div>
          {/* Toggle favoritos */}
          <button
            onClick={() => setMostrarFavoritos(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              mostrarFavoritos
                ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                : "bg-muted text-muted-foreground border-border hover:text-yellow-400 hover:border-yellow-500/30"
            }`}
          >
            <Star className={`w-4 h-4 ${mostrarFavoritos ? "fill-yellow-400 text-yellow-400" : ""}`} />
            {mostrarFavoritos ? `Favoritos (${favoritos.size})` : "Ver favoritos"}
          </button>
        </div>

        {/* ─── Seção: Adicionados Recentemente ────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h2 className="text-foreground font-semibold text-sm">Adicionados Recentemente</h2>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Últimos 2</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentes.map(doc => {
              const Icon = CATEGORIA_ICONS[doc.categoria];
              return (
                <div
                  key={doc.id}
                  className="bg-card border border-blue-500/20 rounded-xl p-4 hover:border-blue-500/40 transition-colors cursor-pointer"
                  onClick={() => {
                    if (doc.url.startsWith("http")) window.open(doc.url, "_blank");
                    else window.location.href = doc.url;
                    handleDownload(doc.id, doc.url);
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium">Novo</span>
                  </div>
                  <p className="text-foreground text-xs font-semibold leading-tight line-clamp-2">{doc.titulo}</p>
                  <div className="flex items-center gap-1 mt-2 text-muted-foreground text-xs">
                    <Clock className="w-3 h-3" />
                    <span>{doc.dataUpload}</span>
                    <span className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${TIPO_COLORS[doc.tipo]}`}>{doc.tipo}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Seção: Mais Acessados ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-yellow-400" />
            <h2 className="text-foreground font-semibold text-sm">Documentos Mais Acessados</h2>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Top 3</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {maisAcessados.map((doc, idx) => {
              const Icon = CATEGORIA_ICONS[doc.categoria];
              const medals = ["🥇", "🥈", "🥉"];
              return (
                <div
                  key={doc.id}
                  className="bg-card border border-border rounded-xl p-4 hover:border-yellow-500/30 transition-colors cursor-pointer"
                  onClick={() => {
                    if (doc.url.startsWith("http")) window.open(doc.url, "_blank");
                    else window.location.href = doc.url;
                    handleDownload(doc.id, doc.url);
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg">{medals[idx]}</span>
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                  <p className="text-foreground text-xs font-semibold leading-tight line-clamp-2">{doc.titulo}</p>
                  <div className="flex items-center gap-1 mt-2 text-muted-foreground text-xs">
                    <Download className="w-3 h-3" />
                    <span>{downloadCounts[doc.id]} acessos</span>
                    <Star className="w-3 h-3 text-yellow-500 ml-auto" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filtros */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Busca */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou descrição..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="w-full bg-muted border border-border text-foreground text-sm rounded-lg pl-9 pr-4 py-2 outline-none focus:border-blue-500 transition-colors"
                />
                {busca && (
                  <button
                    onClick={() => setBusca("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filtro de categoria */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex bg-muted border border-border rounded-lg overflow-hidden">
                  {categorias.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFiltroCategoria(cat)}
                      className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        filtroCategoria === cat
                          ? "bg-blue-600 text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-gray-700"
                      }`}
                    >
                      {cat === "todos" ? "Todos" : CATEGORIA_LABELS[cat as Documento["categoria"]]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Resultado de busca */}
            {busca && (
              <p className="text-xs text-muted-foreground mt-2">
                {documentosFiltrados.length === 0
                  ? "Nenhum resultado encontrado"
                  : `${documentosFiltrados.length} resultado${documentosFiltrados.length !== 1 ? "s" : ""} para "${busca}"`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Estatísticas rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total de Documentos", value: DOCUMENTOS.length, color: "text-blue-400" },
            { label: "Total de Downloads", value: Object.values(downloadCounts).reduce((a, b) => a + b, 0), color: "text-green-400" },
            { label: "Favoritos", value: favoritos.size, color: "text-yellow-400" },
            { label: "Última Atualização", value: "07/04/2026", color: "text-purple-400", isText: true },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className={`text-xl font-bold truncate ${stat.color}`}>{stat.value}</p>
              <p className="text-muted-foreground text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Lista de documentos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-foreground font-semibold text-sm flex items-center gap-2">
              {mostrarFavoritos ? (
                <><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> Meus Favoritos</>
              ) : (
                <><Clock className="w-4 h-4 text-muted-foreground" /> Todos os Documentos</>
              )}
              <span className="text-muted-foreground font-normal text-xs">({documentosFiltrados.length})</span>
            </h2>
          </div>

          {documentosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {mostrarFavoritos ? (
                <>
                  <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum favorito ainda. Clique na estrela ⭐ em qualquer documento para favoritar.</p>
                </>
              ) : (
                <>
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum documento encontrado para os filtros selecionados.</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {documentosFiltrados.map(doc => (
                <DocumentoCard
                  key={doc.id}
                  doc={doc}
                  downloads={downloadCounts[doc.id] ?? doc.downloadsIniciais}
                  isFavorito={favoritos.has(doc.id)}
                  onDownload={handleDownload}
                  onToggleFavorito={handleToggleFavorito}
                  busca={busca}
                />
              ))}
            </div>
          )}
        </div>

        {/* Nota informativa */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Download className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-blue-400 text-sm font-medium">Sobre os documentos</p>
              <p className="text-muted-foreground text-xs mt-1">
                Os arquivos PDF são servidos via CDN para garantir download rápido. Documentos marcados como "Gerado dinamicamente"
                são exportados diretamente das páginas do dashboard com dados em tempo real. Favoritos e contadores são mantidos durante a sessão.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
