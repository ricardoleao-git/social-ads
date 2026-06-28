import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Mail,
  PauseCircle,
  RefreshCw,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ─── Dados da análise (02/04/2026) ───────────────────────────────────────────

const GRUPOS_PAUSADOS = [
  {
    id: "198104641434",
    nome: "Institucional - Zênite Tech",
    impressoes: 2,
    cliques: 0,
    custo: 0,
    recomendacao: "MANTER PAUSADO",
    cor: "bg-gray-100 text-gray-700 border-gray-200",
    motivo: "Palavras de marca com volume muito baixo. Reativar quando CTR principal superar 10%.",
    keywords: [
      { texto: "zenite tech", tipo: "EXACT" },
      { texto: "zintech", tipo: "PHRASE" },
    ],
    migrarPara: null,
  },
  {
    id: "198104641114",
    nome: "Avant RH - Automação de RH",
    impressoes: 0,
    cliques: 0,
    custo: 0,
    recomendacao: "AVALIAR EXCLUSÃO",
    cor: "bg-red-50 text-red-700 border-red-200",
    motivo: "Sem palavras-chave ativas. Produto de nicho com baixo volume de busca.",
    keywords: [],
    migrarPara: null,
  },
  {
    id: "198104641154",
    nome: "ConciergIA - Clínicas e Saúde",
    impressoes: 0,
    cliques: 0,
    custo: 0,
    recomendacao: "MIGRAR KEYWORDS",
    cor: "bg-blue-50 text-blue-700 border-blue-200",
    motivo: "Palavras de alta intenção relevantes para o grupo WhatsApp ativo.",
    keywords: [
      { texto: "chatbot para clínica", tipo: "EXACT" },
      { texto: "confirmação automática de consulta", tipo: "EXACT" },
      { texto: "confirmação de consulta whatsapp", tipo: "EXACT" },
      { texto: "ia para clínica médica", tipo: "EXACT" },
      { texto: "chatbot para clínicas", tipo: "PHRASE" },
      { texto: "ia para agendamento médico", tipo: "PHRASE" },
      { texto: "agendamento automático clínica", tipo: "BROAD" },
      { texto: "atendimento automático clínica", tipo: "BROAD" },
    ],
    migrarPara: "WhatsApp (ID: 198104641914)",
  },
  {
    id: "198104641354",
    nome: "Fila Inteligente - Escolas",
    impressoes: 0,
    cliques: 0,
    custo: 0,
    recomendacao: "MIGRAR KEYWORDS",
    cor: "bg-blue-50 text-blue-700 border-blue-200",
    motivo: "Palavras complementares ao grupo Acesso Escolas ativo.",
    keywords: [
      { texto: "app saída escolar", tipo: "EXACT" },
      { texto: "controle de saída de alunos", tipo: "EXACT" },
      { texto: "fila inteligente para escola", tipo: "EXACT" },
      { texto: "organização saída de alunos", tipo: "EXACT" },
      { texto: "sistema de fila para escolas", tipo: "EXACT" },
      { texto: "sistema de saída de alunos", tipo: "EXACT" },
      { texto: "aplicativo fila escolar", tipo: "PHRASE" },
      { texto: "fila inteligente escola", tipo: "PHRASE" },
      { texto: "gestão de saída escolar", tipo: "PHRASE" },
      { texto: "saída de alunos organizada", tipo: "PHRASE" },
      { texto: "segurança na saída de alunos", tipo: "PHRASE" },
    ],
    migrarPara: "Acesso Escolas (ID: 198104641874)",
  },
  {
    id: "198104641394",
    nome: "GuardIA - Câmaras Frias",
    impressoes: 0,
    cliques: 0,
    custo: 0,
    recomendacao: "AVALIAR EXCLUSÃO",
    cor: "bg-red-50 text-red-700 border-red-200",
    motivo: "Sem palavras-chave ativas. Nicho muito específico com baixo volume.",
    keywords: [],
    migrarPara: null,
  },
  {
    id: "198104641634",
    nome: "Prédio Inteligente - Smart Building",
    impressoes: 0,
    cliques: 0,
    custo: 0,
    recomendacao: "MIGRAR KEYWORDS",
    cor: "bg-blue-50 text-blue-700 border-blue-200",
    motivo: "Palavras relevantes para condomínios e automação predial.",
    keywords: [
      { texto: "automação predial empresas", tipo: "EXACT" },
      { texto: "smart building empresas", tipo: "EXACT" },
      { texto: "automação predial", tipo: "PHRASE" },
      { texto: "condomínio inteligente tecnologia", tipo: "BROAD" },
      { texto: "empresa de automação predial", tipo: "BROAD" },
      { texto: "integração de sistemas prediais", tipo: "BROAD" },
      { texto: "prédio inteligente tecnologia", tipo: "BROAD" },
      { texto: "tecnologia para condomínio alto padrão", tipo: "BROAD" },
    ],
    migrarPara: "Acesso Condomínios (ID: 198104641834)",
  },
];

const GRUPOS_ATIVOS = [
  { id: "198104641834", nome: "Acesso Condomínios" },
  { id: "198104641194", nome: "Acesso Controle" },
  { id: "198104641874", nome: "Acesso Escolas" },
  { id: "198104640954", nome: "Social Ads" },
  { id: "198104641594", nome: "PABX" },
  { id: "198104641674", nome: "REP" },
  { id: "198104641914", nome: "WhatsApp" },
];

const MATCH_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  EXACT: { label: "Exata", color: "bg-green-100 text-green-800" },
  PHRASE: { label: "Frase", color: "bg-blue-100 text-blue-800" },
  BROAD: { label: "Ampla", color: "bg-yellow-100 text-yellow-800" },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PausedGroups() {
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const sendEmailMutation = trpc.googleAds.sendPausedGroupsReport.useMutation({
    onSuccess: (data: { success: boolean; message?: string; error?: string }) => {
      if (data.success) {
        toast.success("Relatório enviado com sucesso para rjll70@gmail.com");
      } else {
        toast.error(`Erro ao enviar: ${data.error ?? "Tente novamente"}`);
      }
      setIsSendingEmail(false);
    },
    onError: (err: { message: string }) => {
      toast.error(`Erro: ${err.message}`);
      setIsSendingEmail(false);
    },
  });

  const handleSendEmail = () => {
    setIsSendingEmail(true);
    sendEmailMutation.mutate({});
  };

  const totalPausados = GRUPOS_PAUSADOS.length;
  const totalKeywords = GRUPOS_PAUSADOS.reduce((s, g) => s + g.keywords.length, 0);
  const gruposMigrar = GRUPOS_PAUSADOS.filter((g) => g.recomendacao === "MIGRAR KEYWORDS").length;
  const gruposExcluir = GRUPOS_PAUSADOS.filter((g) => g.recomendacao === "AVALIAR EXCLUSÃO").length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <PauseCircle className="h-6 w-6 text-amber-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Grupos Pausados</h1>
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
              Análise 02/04/2026
            </Badge>
          </div>
          <Button
            onClick={handleSendEmail}
            disabled={isSendingEmail}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-foreground text-sm"
          >
            {isSendingEmail ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {isSendingEmail ? "Enviando..." : "Compartilhar por E-mail"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Campanha <strong>Pesquisa Leads</strong> · Zênite Tech · {totalPausados} grupos pausados com {totalKeywords} palavras-chave analisadas
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Grupos Pausados", value: totalPausados, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Grupos Ativos", value: GRUPOS_ATIVOS.length, color: "text-green-600", bg: "bg-green-50" },
          { label: "Migrar Keywords", value: gruposMigrar, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Avaliar Exclusão", value: gruposExcluir, color: "text-red-600", bg: "bg-red-50" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${kpi.bg} mb-2`}>
                <span className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</span>
              </div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="keywords">Palavras-chave</TabsTrigger>
          <TabsTrigger value="proximos-passos">Próximos Passos</TabsTrigger>
        </TabsList>

        {/* ── Aba: Visão Geral ─────────────────────────────────────────────── */}
        <TabsContent value="visao-geral" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PauseCircle className="h-4 w-4 text-amber-600" />
                Grupos Pausados — Situação e Recomendação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="pb-2 pr-4 font-medium">Grupo</th>
                      <th className="pb-2 pr-4 font-medium text-center">Impr.</th>
                      <th className="pb-2 pr-4 font-medium text-center">Cliques</th>
                      <th className="pb-2 pr-4 font-medium text-center">Keywords</th>
                      <th className="pb-2 pr-4 font-medium">Migrar Para</th>
                      <th className="pb-2 font-medium">Recomendação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {GRUPOS_PAUSADOS.map((g) => (
                      <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-gray-900">{g.nome}</p>
                          <p className="text-xs text-muted-foreground font-mono">{g.id}</p>
                        </td>
                        <td className="py-3 pr-4 text-center text-gray-600">{g.impressoes}</td>
                        <td className="py-3 pr-4 text-center text-gray-600">{g.cliques}</td>
                        <td className="py-3 pr-4 text-center">
                          <span className={`font-semibold ${g.keywords.length > 0 ? "text-blue-700" : "text-muted-foreground"}`}>
                            {g.keywords.length}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {g.migrarPara ? (
                            <div className="flex items-center gap-1 text-xs text-blue-700">
                              <ArrowRight className="h-3 w-3" />
                              {g.migrarPara}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${g.cor}`}>
                            {g.recomendacao}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Grupos Ativos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Grupos Ativos (7 grupos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {GRUPOS_ATIVOS.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 p-2.5 border border-gray-100 rounded-lg bg-green-50/50">
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{g.nome}</p>
                      <p className="text-xs text-muted-foreground font-mono">{g.id}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Aba: Palavras-chave ──────────────────────────────────────────── */}
        <TabsContent value="keywords" className="space-y-4 mt-4">
          {GRUPOS_PAUSADOS.filter((g) => g.keywords.length > 0).map((g) => (
            <Card key={g.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="h-4 w-4 text-blue-600" />
                    {g.nome}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${g.cor}`}>
                      {g.recomendacao}
                    </span>
                    {g.migrarPara && (
                      <span className="text-xs text-blue-600 flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        {g.migrarPara}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">{g.motivo}</p>
                <div className="flex flex-wrap gap-2">
                  {g.keywords.map((kw) => {
                    const mt = MATCH_TYPE_LABEL[kw.tipo] ?? { label: kw.tipo, color: "bg-gray-100 text-gray-700" };
                    return (
                      <div key={kw.texto} className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${mt.color}`}>
                          {mt.label}
                        </span>
                        <span className="text-sm text-gray-800">{kw.texto}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Grupos sem keywords */}
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Grupos sem palavras-chave</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>Avant RH</strong> e <strong>GuardIA - Câmaras Frias</strong> não possuem palavras-chave ativas.
                    Recomenda-se avaliar a exclusão definitiva após 30 dias se não houver plano de reativação.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Aba: Próximos Passos ─────────────────────────────────────────── */}
        <TabsContent value="proximos-passos" className="space-y-4 mt-4">
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Palavras-chave Positivas vs. Negativas</p>
                  <p className="text-xs text-amber-700 mt-1">
                    O botão "Adicionar como Negativo" no dashboard serve para <strong>bloquear termos irrelevantes</strong>.
                    Para migrar palavras-chave positivas de grupos pausados para grupos ativos, use o Google Ads diretamente.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {[
              {
                prazo: "Imediato (via Dashboard)",
                cor: "border-l-red-500",
                acoes: [
                  "Usar o botão \"Adicionar como Negativo\" para bloquear termos irrelevantes dos Termos de Pesquisa (ex: \"gratuito\", \"free\", \"emprego\", \"concurso\")",
                ],
              },
              {
                prazo: "Esta semana (via Google Ads)",
                cor: "border-l-blue-500",
                acoes: [
                  "Grupo WhatsApp → Adicionar: [chatbot para clínica], [confirmação de consulta whatsapp], [ia para clínica médica], \"ia para agendamento médico\"",
                  "Grupo Acesso Escolas → Adicionar: [controle de saída de alunos], [sistema de saída de alunos], [sistema de fila para escolas], \"gestão de saída escolar\"",
                  "Grupo Acesso Condomínios → Adicionar: [smart building empresas], [automação predial empresas], \"automação predial\"",
                ],
              },
              {
                prazo: "Em 14 dias",
                cor: "border-l-green-500",
                acoes: [
                  "Avaliar CTR dos grupos que receberam as novas palavras-chave positivas",
                  "Verificar se houve aumento de impressões e cliques qualificados",
                ],
              },
              {
                prazo: "Em 30 dias",
                cor: "border-l-purple-500",
                acoes: [
                  "Decidir sobre reativação do grupo Institucional se CTR da campanha superar 10%",
                  "Avaliar exclusão definitiva de Avant RH e GuardIA - Câmaras Frias",
                ],
              },
            ].map((step) => (
              <Card key={step.prazo} className={`border-l-4 ${step.cor}`}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm font-semibold text-gray-800 mb-2">{step.prazo}</p>
                  <ul className="space-y-1.5">
                    {step.acoes.map((acao, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <ArrowRight className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                        {acao}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-center pt-2">
            <Button
              onClick={handleSendEmail}
              disabled={isSendingEmail}
              variant="outline"
              className="flex items-center gap-2 text-sm"
            >
              {isSendingEmail ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {isSendingEmail ? "Enviando..." : "Enviar esta análise por e-mail"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
