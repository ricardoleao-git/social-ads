/**
 * AIChatDashboard — Chat com IA para gestão de tráfego pago
 * Permite consultar métricas, dar comandos e receber análises estratégicas
 * Melhorias: dados reais da API, indicador digitando, copiar código, 👍/👎
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send, Bot, User, Zap, BarChart3, Search,
  AlertTriangle, FileText, RefreshCw, Trash2,
  MessageSquare, Lightbulb, TrendingUp, Copy, Check,
  ThumbsUp, ThumbsDown, Download, Pencil, X
} from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  hasAction?: boolean;
  feedback?: "up" | "down" | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  "análise": "bg-blue-900 text-blue-300",
  "diagnóstico": "bg-red-900 text-red-300",
  "negativos": "bg-orange-900 text-orange-300",
  "otimização": "bg-green-900 text-green-300",
  "experimentos": "bg-purple-900 text-purple-300",
  "relatório": "bg-gray-700 text-muted-foreground",
  "estratégia": "bg-yellow-900 text-yellow-300",
  "rsa": "bg-pink-900 text-pink-300",
  "orçamento": "bg-teal-900 text-teal-300",
};

// Renderiza markdown com suporte a blocos de código com botão de cópia
function MessageContent({ content }: { content: string }) {
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);

  const handleCopyCode = useCallback((code: string, index: number) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedBlock(index);
      toast("Código copiado!");
      setTimeout(() => setCopiedBlock(null), 2000);
    }).catch(() => {
      toast.error("Não foi possível copiar");
    });
  }, []);

  // Dividir o conteúdo em partes: texto normal e blocos de código
  const parts: Array<{ type: "text" | "code"; content: string; lang?: string }> = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", content: match[2].trim(), lang: match[1] || "text" });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  const renderText = (text: string) => {
    // Processar markdown inline
    const html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-slate-200 dark:bg-gray-700 text-slate-800 dark:text-slate-200 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
      .replace(/^### (.*)/gm, '<h3 class="font-semibold text-sm mt-3 mb-1">$1</h3>')
      .replace(/^## (.*)/gm, '<h2 class="font-semibold text-base mt-3 mb-1">$1</h2>')
      .replace(/^# (.*)/gm, '<h1 class="font-bold text-base mt-3 mb-1">$1</h1>')
      .replace(/^- (.*)/gm, '<div class="flex gap-2 my-0.5"><span class="text-blue-400 flex-shrink-0">•</span><span>$1</span></div>')
      .replace(/^\d+\. (.*)/gm, '<div class="flex gap-2 my-0.5"><span class="text-blue-400 flex-shrink-0 font-mono text-xs">›</span><span>$1</span></div>')
      .replace(/\n\n/g, '<div class="h-2"></div>')
      .replace(/\n/g, '<br/>');
    return <div dangerouslySetInnerHTML={{ __html: html }} className="prose prose-slate dark:prose-invert prose-sm max-w-none" />;
  };

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.type === "code") {
          return (
            <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600">
              {/* Header do bloco de código */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-200 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-600">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{part.lang}</span>
                <button
                  onClick={() => handleCopyCode(part.content, i)}
                  className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  {copiedBlock === i
                    ? <><Check className="w-3 h-3 text-green-500" /><span className="text-green-500">Copiado</span></>
                    : <><Copy className="w-3 h-3" /><span>Copiar</span></>
                  }
                </button>
              </div>
              {/* Conteúdo do código */}
              <pre className="px-4 py-3 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {part.content}
              </pre>
            </div>
          );
        }
        return <div key={i}>{renderText(part.content)}</div>;
      })}
    </div>
  );
}

export default function AIChatDashboard() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá, Ricardo! Sou o Assistente de Tráfego Pago da Zênite Tech. Posso analisar suas campanhas com **dados reais** do Google Ads, sugerir otimizações, identificar termos para negativar e muito mais.\n\n**Como posso ajudar hoje?** Use as sugestões abaixo ou faça sua pergunta diretamente.",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [conversationId] = useState(() => `conv_${Date.now()}`);
  const [currentPage] = useState("Dashboard Principal");
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const { data: suggestions } = trpc.aiChat.getQuickSuggestions.useQuery();

  // Mutation
  const sendMessage = trpc.aiChat.sendMessage.useMutation({
    onSuccess: (data) => {
      const assistantMsg: Message = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        hasAction: data.hasAction,
        feedback: null,
      };
      setMessages(prev => [...prev, assistantMsg]);
    },
    onError: () => {
      const errorMsg: Message = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: "Desculpe, ocorreu um erro ao processar sua mensagem. Verifique a conexão e tente novamente.",
        timestamp: new Date(),
        feedback: null,
      };
      setMessages(prev => [...prev, errorMsg]);
    },
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMessage.isPending) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    sendMessage.mutate({
      message: text,
      conversationId,
      context: { currentPage },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const handleFeedback = (msgId: string, feedback: "up" | "down") => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      // Toggle: se já tem o mesmo feedback, remove; senão, aplica
      const newFeedback = m.feedback === feedback ? null : feedback;
      if (newFeedback === "up") toast("Obrigado pelo feedback positivo! 👍");
      if (newFeedback === "down") toast("Feedback registrado. Vamos melhorar! 👎");
      return { ...m, feedback: newFeedback };
    }));
  };

  // Exportar histórico como texto
  const exportHistory = () => {
    const lines: string[] = [
      `=== Histórico do Chat — Assistente de Tráfego Pago ===`,
      `Exportado em: ${new Date().toLocaleString("pt-BR")}`,
      `Conversa ID: ${conversationId}`,
      ``,
    ];
    messages.forEach(m => {
      const role = m.role === "user" ? "Ricardo" : "IA";
      const time = m.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      lines.push(`[${time}] ${role}:`);
      lines.push(m.content);
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-trafego-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Histórico exportado!");
  };

  // Iniciar edição de mensagem do usuário
  const startEdit = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditingContent(msg.content);
  };

  // Confirmar edição: atualiza a mensagem e reenviar ao LLM
  const confirmEdit = (msgId: string) => {
    const newContent = editingContent.trim();
    if (!newContent) return;
    // Atualiza a mensagem editada e remove todas as mensagens posteriores
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msgId);
      if (idx === -1) return prev;
      const updated = prev.slice(0, idx + 1).map(m =>
        m.id === msgId ? { ...m, content: newContent } : m
      );
      return updated;
    });
    setEditingMsgId(null);
    setEditingContent("");
    // Reenviar ao LLM
    sendMessage.mutate({ message: newContent, conversationId, context: { currentPage } });
    toast("Mensagem editada e reenviada!");
  };

  const clearChat = () => {
    setMessages([{
      id: "welcome_new",
      role: "assistant",
      content: "Conversa reiniciada. Como posso ajudar com suas campanhas?",
      timestamp: new Date(),
      feedback: null,
    }]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-foreground font-semibold text-sm">Assistente de Tráfego Pago</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <p className="text-muted-foreground text-xs">Online · Dados reais da conta</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-900 text-blue-300 text-xs">
            <Zap className="w-3 h-3 mr-1" />IA + API
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={exportHistory}
            className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 p-0"
            title="Exportar histórico"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 p-0"
            title="Limpar conversa"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Capacidades rápidas */}
      <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border overflow-x-auto flex-shrink-0">
        {[
          { icon: BarChart3, label: "Análise", color: "text-blue-400" },
          { icon: Search, label: "Termos", color: "text-orange-400" },
          { icon: AlertTriangle, label: "Alertas", color: "text-red-400" },
          { icon: TrendingUp, label: "Otimização", color: "text-green-400" },
          { icon: FileText, label: "Relatório", color: "text-purple-400" },
          { icon: Lightbulb, label: "Estratégia", color: "text-yellow-400" },
        ].map((cap, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-full flex-shrink-0">
            <cap.icon className={`w-3 h-3 ${cap.color}`} />
            <span className="text-muted-foreground text-xs">{cap.label}</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === "assistant"
                ? "bg-gradient-to-br from-blue-600 to-purple-600"
                : "bg-gray-700"
            }`}>
              {msg.role === "assistant"
                ? <Bot className="w-4 h-4 text-foreground" />
                : <User className="w-4 h-4 text-muted-foreground" />
              }
            </div>

            {/* Bubble + feedback */}
            <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              {/* Modo edição inline para mensagens do usuário */}
              {msg.role === "user" && editingMsgId === msg.id ? (
                <div className="flex flex-col gap-2 w-full min-w-[240px]">
                  <textarea
                    value={editingContent}
                    onChange={e => setEditingContent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm bg-blue-800 text-white border border-blue-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                    rows={3}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); confirmEdit(msg.id); }
                      if (e.key === "Escape") { setEditingMsgId(null); setEditingContent(""); }
                    }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setEditingMsgId(null); setEditingContent(""); }}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-white rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => confirmEdit(msg.id)}
                      className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium"
                    >
                      Enviar
                    </button>
                  </div>
                </div>
              ) : (
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-700 text-foreground rounded-tr-sm"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-600 rounded-tl-sm"
              }`}>
                {msg.role === "assistant"
                  ? <MessageContent content={msg.content} />
                  : msg.content
                }
              </div>
              )}

              {/* Footer: timestamp + ação + feedback (só para IA) */}
              <div className={`flex items-center gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <span className="text-muted-foreground text-xs">
                  {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {/* Botão editar para mensagens do usuário */}
                {msg.role === "user" && editingMsgId !== msg.id && (
                  <button
                    onClick={() => startEdit(msg)}
                    title="Editar mensagem"
                    className="p-1 rounded text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                {msg.hasAction && (
                  <Badge className="bg-yellow-900 text-yellow-300 text-xs">
                    <Zap className="w-2.5 h-2.5 mr-1" />Ação detectada
                  </Badge>
                )}
                {/* Botões de feedback apenas para mensagens da IA (exceto welcome) */}
                {msg.role === "assistant" && msg.id !== "welcome" && msg.id !== "welcome_new" && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleFeedback(msg.id, "up")}
                      title="Resposta útil"
                      className={`p-1 rounded transition-colors ${
                        msg.feedback === "up"
                          ? "text-green-500 bg-green-500/10"
                          : "text-muted-foreground hover:text-green-500 hover:bg-green-500/10"
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleFeedback(msg.id, "down")}
                      title="Resposta ruim"
                      className={`p-1 rounded transition-colors ${
                        msg.feedback === "down"
                          ? "text-red-500 bg-red-500/10"
                          : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                      }`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Indicador "digitando..." */}
        {sendMessage.isPending && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="px-4 py-3 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl rounded-tl-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
              <span className="text-muted-foreground text-xs px-1">Consultando dados da conta...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && suggestions?.suggestions && (
        <div className="px-4 py-3 border-t border-border bg-card flex-shrink-0">
          <p className="text-muted-foreground text-xs mb-2 flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3" />
            Sugestões rápidas:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.suggestions.slice(0, 5).map((sug) => (
              <button
                key={sug.id}
                onClick={() => handleSuggestion(sug.text)}
                className={`px-3 py-1.5 rounded-full text-xs border border-border hover:border-gray-500 transition-colors ${CATEGORY_COLORS[sug.category] ?? "bg-muted text-muted-foreground"}`}
              >
                {sug.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-card border-t border-border flex-shrink-0">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre campanhas, peça análises ou dê comandos... (Enter para enviar)"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:border-blue-500 min-h-[44px] max-h-[120px]"
              rows={1}
              style={{ height: "auto" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 120) + "px";
              }}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className="bg-blue-700 hover:bg-blue-600 text-foreground h-11 w-11 p-0 rounded-xl flex-shrink-0"
          >
            {sendMessage.isPending
              ? <RefreshCw className="w-5 h-5 animate-spin" />
              : <Send className="w-5 h-5" />
            }
          </Button>
        </div>
        <p className="text-muted-foreground text-xs mt-1.5 text-center">
          Shift+Enter para nova linha · As ações sugeridas pela IA precisam de confirmação antes de serem executadas
        </p>
      </div>
    </div>
  );
}
