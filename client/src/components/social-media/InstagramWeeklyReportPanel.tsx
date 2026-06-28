import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Calendar, CheckCircle, AlertCircle, Eye, Send,
  Clock, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

export function InstagramWeeklyReportPanel() {
  const [recipient, setRecipient] = useState("rjll70@gmail.com");
  const [includeTopPost, setIncludeTopPost] = useState(true);
  const [includeTypeBreakdown, setIncludeTypeBreakdown] = useState(true);
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  const sendMutation = trpc.instagram.sendWeeklyReport.useMutation({
    onSuccess: (data) => {
      if (data.preview) {
        setPreviewBody(data.body ?? null);
        setShowPreview(true);
        return;
      }
      if (data.emailSent) {
        toast.success(`Relatório enviado para ${data.recipient}!`);
        setLastSent(new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }));
      } else {
        toast.error(`Falha ao enviar: ${data.emailError}`);
      }
    },
    onError: (err) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const handlePreview = () => {
    sendMutation.mutate({ to: recipient, includeTopPost, includeTypeBreakdown, preview: true });
  };

  const handleSend = () => {
    sendMutation.mutate({ to: recipient, includeTopPost, includeTypeBreakdown, preview: false });
  };

  // Calcular próxima segunda-feira
  const getNextMonday = () => {
    const now = new Date();
    const day = now.getDay(); // 0=dom, 1=seg...
    const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7;
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntilMonday);
    next.setHours(8, 0, 0, 0);
    return next.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) + " às 08:00";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            Relatório Semanal por E-mail
          </CardTitle>
          <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200 gap-1">
            <Clock className="w-3 h-3" />
            Toda segunda-feira
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Resumo automático de performance do Instagram enviado toda segunda às 08:00
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Próximo envio */}
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
          <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-blue-800">Próximo envio automático</p>
            <p className="text-sm text-blue-700">{getNextMonday()}</p>
          </div>
        </div>

        {/* Destinatário */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">Destinatário</label>
          <Input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="seu@email.com"
            className="text-sm h-9"
          />
        </div>

        {/* Opções de conteúdo */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-2">Incluir no relatório</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTopPost}
                onChange={(e) => setIncludeTopPost(e.target.checked)}
                className="w-4 h-4 accent-purple-600"
              />
              <span className="text-sm text-gray-700">Post com mais engajamento</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTypeBreakdown}
                onChange={(e) => setIncludeTypeBreakdown(e.target.checked)}
                className="w-4 h-4 accent-purple-600"
              />
              <span className="text-sm text-gray-700">Performance por tipo de conteúdo</span>
            </label>
          </div>
        </div>

        {/* Último envio */}
        {lastSent && (
          <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-lg border border-green-100 text-xs text-green-700">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Último envio: {lastSent}
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={sendMutation.isPending}
            className="flex-1 gap-1.5 h-9 text-xs"
          >
            {sendMutation.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            Pré-visualizar
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sendMutation.isPending || !recipient}
            className="flex-1 gap-1.5 h-9 text-xs bg-blue-600 hover:bg-blue-700"
          >
            {sendMutation.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Enviar Agora
          </Button>
        </div>

        {/* Preview do e-mail */}
        {previewBody && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
            >
              <span className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                Pré-visualização do e-mail
              </span>
              {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showPreview && (
              <div className="p-3 bg-white">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                  {previewBody}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Nota sobre automação */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Envio automático toda segunda-feira</p>
            <p>O relatório é gerado automaticamente com os dados mais recentes do banco. Use "Enviar Agora" para um envio manual imediato a qualquer momento.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
