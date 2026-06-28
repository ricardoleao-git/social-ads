import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail, MailOpen, RefreshCw, Search, Filter, CheckCircle,
  AlertCircle, Info, ChevronRight, X, Loader2, Tag
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (hours < 168) return d.toLocaleDateString("pt-BR", { weekday: "short" });
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return dateStr.substring(0, 10);
  }
}

function extractSenderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return from.split("@")[0] || from;
}

function categoryColor(category: string): string {
  const map: Record<string, string> = {
    "Google Ads": "bg-blue-100 text-blue-800 border-blue-200",
    "Search Console": "bg-orange-100 text-orange-800 border-orange-200",
    "Google Business": "bg-green-100 text-green-800 border-green-200",
    "Instagram / Meta": "bg-purple-100 text-purple-800 border-purple-200",
    "Zênite Tech": "bg-cyan-100 text-cyan-800 border-cyan-200",
    "Leads / CRM": "bg-yellow-100 text-yellow-800 border-yellow-200",
    "Dashboard": "bg-indigo-100 text-indigo-800 border-indigo-200",
    "Segurança Eletrônica": "bg-red-100 text-red-800 border-red-200",
    "Outros": "bg-gray-100 text-gray-600 border-gray-200",
  };
  return map[category] || map["Outros"];
}

// ─── Componente Principal ──────────────────────────────────────────────────────
export default function EmailInbox() {
  const [onlyRelevant, setOnlyRelevant] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("Todos");

  const { data: emails, isLoading, refetch, isFetching } = trpc.gmailAlerts.inbox.useQuery(
    { maxResults: 50, onlyRelevant: false, onlyUnread },
    { staleTime: 5 * 60 * 1000 }
  );

  // Badge de não lidos via endpoint dedicado (atualiza a cada 5 min)
  const { data: unreadData } = trpc.gmailAlerts.unreadCount.useQuery(
    undefined,
    { staleTime: 2 * 60 * 1000, refetchInterval: 5 * 60 * 1000 }
  );

  const { data: emailBody, isLoading: bodyLoading } = trpc.gmailAlerts.getEmailBody.useQuery(
    { messageId: selectedId! },
    { enabled: !!selectedId, staleTime: 10 * 60 * 1000 }
  );

  // Categorias disponíveis
  const categories = useMemo(() => {
    if (!emails) return ["Todos"];
    const cats = Array.from(new Set(emails.map((e: any) => e.category)));
    return ["Todos", ...cats.filter(c => c !== "Outros"), "Outros"];
  }, [emails]);

  // Filtros
  const filtered = useMemo(() => {
    if (!emails) return [];
    return emails.filter((e: any) => {
      if (onlyRelevant && !e.relevant) return false;
      if (categoryFilter !== "Todos" && e.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          e.subject.toLowerCase().includes(q) ||
          e.from.toLowerCase().includes(q) ||
          e.snippet.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [emails, onlyRelevant, categoryFilter, search]);

  const relevantCount = useMemo(() => emails?.filter((e: any) => e.relevant).length || 0, [emails]);
  const unreadCount = useMemo(() => emails?.filter((e: any) => !e.isRead).length || 0, [emails]);

  return (
    <div className="flex h-full min-h-screen bg-white">
      {/* Painel esquerdo: lista de e-mails */}
      <div className={`flex flex-col border-r border-gray-200 ${selectedId ? "w-[420px] min-w-[320px]" : "flex-1"}`}>
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              <h1 className="text-lg font-semibold text-gray-900">Caixa de Entrada</h1>
              {unreadCount > 0 && (
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Barra de busca */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar e-mails..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-gray-50 border-gray-200"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>

          {/* Filtros rápidos */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <button
              onClick={() => setOnlyUnread(!onlyUnread)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                onlyUnread
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              <Mail className="w-3 h-3" />
              Não lidos
              {(unreadData?.count ?? unreadCount) > 0 && (
                <span className={`ml-1 font-bold ${
                  onlyUnread ? "text-gray-300" : "text-gray-800"
                }`}>
                  {unreadData?.count ?? unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setOnlyRelevant(!onlyRelevant)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                onlyRelevant
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}
            >
              <Filter className="w-3 h-3" />
              Relevantes
              {relevantCount > 0 && (
                <span className={`ml-1 font-bold ${onlyRelevant ? "text-blue-100" : "text-blue-600"}`}>
                  {relevantCount}
                </span>
              )}
            </button>
          </div>

          {/* Filtro por categoria */}
          <div className="flex gap-1.5 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  categoryFilter === cat
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de e-mails */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-gray-500">Carregando e-mails...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <MailOpen className="w-10 h-10 mb-2" />
              <p className="text-sm">Nenhum e-mail encontrado</p>
            </div>
          ) : (
            filtered.map((email: any) => (
              <button
                key={email.id}
                onClick={() => setSelectedId(selectedId === email.id ? null : email.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors hover:bg-blue-50 ${
                  selectedId === email.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                } ${!email.isRead ? "bg-blue-50/40" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Remetente + data */}
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm truncate ${!email.isRead ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                        {extractSenderName(email.from)}
                      </span>
                      <span className="text-xs text-gray-400 ml-2 shrink-0">{formatDate(email.date)}</span>
                    </div>

                    {/* Assunto */}
                    <p className={`text-sm truncate mb-1 ${!email.isRead ? "font-medium text-gray-800" : "text-gray-600"}`}>
                      {email.subject}
                    </p>

                    {/* Snippet */}
                    <p className="text-xs text-gray-400 truncate">{email.snippet}</p>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {email.relevant && (
                        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                          <CheckCircle className="w-3 h-3" />
                          Relevante
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColor(email.category)}`}>
                        <Tag className="w-2.5 h-2.5 inline mr-0.5" />
                        {email.category}
                      </span>
                      {!email.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-0.5" />
                      )}
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-gray-300 shrink-0 mt-1 transition-transform ${selectedId === email.id ? "rotate-90" : ""}`} />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {emails && (
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
            <span>{filtered.length} de {emails.length} e-mails</span>
            <span className="text-green-600 font-medium">{relevantCount} relevantes para projetos digitais</span>
          </div>
        )}
      </div>

      {/* Painel direito: conteúdo do e-mail */}
      {selectedId && (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header do e-mail */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {bodyLoading ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Carregando...</span>
                </div>
              ) : emailBody ? (
                <>
                  <h2 className="text-base font-semibold text-gray-900 mb-1">{emailBody.subject}</h2>
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-gray-700">De:</span> {emailBody.from}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{emailBody.date}</p>

                  {/* Badge de relevância do e-mail selecionado */}
                  {(() => {
                    const sel = emails?.find((e: any) => e.id === selectedId);
                    if (!sel) return null;
                    return (
                      <div className="flex items-center gap-2 mt-2">
                        {sel.relevant ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Relevante para projetos digitais — {sel.category}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                            <Info className="w-3.5 h-3.5" />
                            Não relacionado aos projetos digitais
                          </span>
                        )}
                        <span className="text-xs text-gray-400">Score: {sel.score}</span>
                      </div>
                    );
                  })()}
                </>
              ) : null}
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="ml-4 p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Corpo do e-mail */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {bodyLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : emailBody ? (
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-4 border border-gray-100">
                  {emailBody.body || "(Corpo do e-mail não disponível em texto simples)"}
                </pre>
              </div>
            ) : (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <AlertCircle className="w-5 h-5 mr-2" />
                <span className="text-sm">Não foi possível carregar o conteúdo</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estado vazio quando nenhum e-mail selecionado e painel dividido */}
      {!selectedId && !isLoading && filtered.length > 0 && (
        <div className="hidden lg:flex flex-1 items-center justify-center text-gray-300">
          <div className="text-center">
            <MailOpen className="w-12 h-12 mx-auto mb-3" />
            <p className="text-sm">Selecione um e-mail para visualizar</p>
          </div>
        </div>
      )}
    </div>
  );
}
