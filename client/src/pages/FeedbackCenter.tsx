import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MessageSquarePlus, Bug, Lightbulb, TrendingUp, MoreHorizontal,
  CheckCircle2, Clock, AlertCircle, XCircle, RefreshCw, Trash2
} from "lucide-react";

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  suggestion: { label: "Sugestão", icon: <Lightbulb className="w-4 h-4" />, color: "bg-blue-100 text-blue-800" },
  bug: { label: "Bug", icon: <Bug className="w-4 h-4" />, color: "bg-red-100 text-red-800" },
  improvement: { label: "Melhoria", icon: <TrendingUp className="w-4 h-4" />, color: "bg-purple-100 text-purple-800" },
  other: { label: "Outro", icon: <MoreHorizontal className="w-4 h-4" />, color: "bg-gray-100 text-gray-800" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  open: { label: "Aberto", icon: <Clock className="w-3 h-3" />, color: "bg-yellow-100 text-yellow-800" },
  in_progress: { label: "Em andamento", icon: <RefreshCw className="w-3 h-3" />, color: "bg-blue-100 text-blue-800" },
  resolved: { label: "Resolvido", icon: <CheckCircle2 className="w-3 h-3" />, color: "bg-green-100 text-green-800" },
  closed: { label: "Fechado", icon: <XCircle className="w-3 h-3" />, color: "bg-gray-100 text-gray-800" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "bg-gray-100 text-gray-600" },
  medium: { label: "Média", color: "bg-yellow-100 text-yellow-700" },
  high: { label: "Alta", color: "bg-orange-100 text-orange-700" },
  critical: { label: "Crítica", color: "bg-red-100 text-red-700" },
};

export default function FeedbackCenter() {
  const [typeFilter, setTypeFilter] = useState<"all" | "suggestion" | "bug" | "improvement" | "other">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "resolved" | "closed">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: "suggestion" as "suggestion" | "bug" | "improvement" | "other",
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "critical",
    page: window.location.pathname,
  });

  const { data, refetch } = trpc.userFeedback.list.useQuery({ type: typeFilter, status: statusFilter });
  const { data: stats } = trpc.userFeedback.stats.useQuery();
  const createMutation = trpc.userFeedback.create.useMutation({
    onSuccess: () => {
      toast.success("Feedback enviado com sucesso!");
      setShowForm(false);
      setForm({ type: "suggestion", title: "", description: "", priority: "medium", page: window.location.pathname });
      refetch();
    },
    onError: (e) => toast.error("Erro ao enviar: " + e.message),
  });
  const updateMutation = trpc.userFeedback.update.useMutation({
    onSuccess: () => { toast.success("Status atualizado"); refetch(); },
  });
  const deleteMutation = trpc.userFeedback.delete.useMutation({
    onSuccess: () => { toast.success("Feedback removido"); refetch(); },
  });

  const handleSubmit = () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Preencha título e descrição");
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Central de Feedback</h1>
          <p className="text-sm text-gray-500 mt-1">Sugestões, bugs e melhorias para o dashboard</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <MessageSquarePlus className="w-4 h-4" />
          Novo Feedback
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-gray-700" },
            { label: "Abertos", value: stats.open, color: "text-yellow-600" },
            { label: "Resolvidos", value: stats.resolved, color: "text-green-600" },
            { label: "Bugs", value: stats.bugs, color: "text-red-600" },
            { label: "Sugestões", value: stats.suggestions, color: "text-blue-600" },
          ].map(s => (
            <Card key={s.label} className="text-center py-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Formulário de novo feedback */}
      {showForm && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-base">Novo Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(["suggestion", "bug", "improvement", "other"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.type === t ? "border-blue-500 bg-blue-100 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {TYPE_CONFIG[t].icon}
                  {TYPE_CONFIG[t].label}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Título do feedback..."
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <textarea
              placeholder="Descreva em detalhes..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 font-medium">Prioridade:</label>
              {(["low", "medium", "high", "critical"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setForm(f => ({ ...f, priority: p }))}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    form.priority === p ? PRIORITY_CONFIG[p].color + " ring-2 ring-offset-1 ring-current" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {PRIORITY_CONFIG[p].label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Enviando..." : "Enviar Feedback"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {(["all", "suggestion", "bug", "improvement", "other"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                typeFilter === t ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t === "all" ? "Todos" : TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-2">
          {(["all", "open", "in_progress", "resolved"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "all" ? "Todos status" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de feedbacks */}
      <div className="space-y-3">
        {!data?.items?.length ? (
          <Card className="text-center py-12 text-gray-400">
            <MessageSquarePlus className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum feedback encontrado</p>
          </Card>
        ) : data.items.map((item: any) => (
          <Card key={item.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_CONFIG[item.type]?.color}`}>
                      {TYPE_CONFIG[item.type]?.icon}
                      {TYPE_CONFIG[item.type]?.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[item.status]?.color}`}>
                      {STATUS_CONFIG[item.status]?.icon}
                      {STATUS_CONFIG[item.status]?.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_CONFIG[item.priority]?.color}`}>
                      {PRIORITY_CONFIG[item.priority]?.label}
                    </span>
                    {item.page && (
                      <span className="text-xs text-gray-400 font-mono">{item.page}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">{item.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                  {item.adminNotes && (
                    <div className="mt-2 px-3 py-2 bg-green-50 border border-green-100 rounded text-xs text-green-700">
                      <strong>Nota:</strong> {item.adminNotes}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {item.authorName} · {new Date(item.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => updateMutation.mutate({ id: item.id, status: "in_progress" })}
                    >
                      Em andamento
                    </Button>
                  )}
                  {(item.status === "open" || item.status === "in_progress") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 text-green-600 border-green-200"
                      onClick={() => updateMutation.mutate({ id: item.id, status: "resolved" })}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 text-red-400 hover:text-red-600"
                    onClick={() => deleteMutation.mutate({ id: item.id })}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
