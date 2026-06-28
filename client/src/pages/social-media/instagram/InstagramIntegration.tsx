import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Instagram,
  CheckCircle,
  RefreshCw,
  Settings,
  Zap,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import LiveInstagramData from "@/components/social-media/LiveInstagramData";
import { InstagramSyncHistory, InstagramEngagementSettings } from "@/components/social-media/InstagramSyncHistory";
import { InstagramPostsGallery } from "@/components/social-media/InstagramPostsGallery";
import { InstagramAlertEmailPanel } from "@/components/social-media/InstagramAlertEmailPanel";
import { InstagramReelsBarChart } from "@/components/social-media/InstagramReelsBarChart";
import { InstagramTopEngagementPost } from "@/components/social-media/InstagramTopEngagementPost";
import { InstagramWeeklyReportPanel } from "@/components/social-media/InstagramWeeklyReportPanel";

export default function InstagramIntegration() {
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  const { data: accounts, refetch } = trpc.instagram.getAccounts.useQuery();
  const syncMutation = trpc.instagram.syncData.useMutation();
  const seedMutation = trpc.instagram.seedInitialData.useMutation();

  const handleSync = async (accountId: string) => {
    setSyncing((prev) => ({ ...prev, [accountId]: true }));
    try {
      await syncMutation.mutateAsync({ accountId });
      toast.success("Sincronização iniciada com sucesso!");
      refetch();
    } catch (error) {
      toast.error("Erro ao sincronizar. Tente novamente.");
    } finally {
      setSyncing((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  const handleSeedData = async () => {
    try {
      await seedMutation.mutateAsync();
      toast.success("Dados iniciais inseridos com sucesso!");
      refetch();
    } catch (error) {
      toast.error("Erro ao inserir dados iniciais.");
    }
  };

  const accountList = accounts ?? [];

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Instagram className="w-6 h-6 text-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Integração Instagram
            </h1>
          </div>
          <p className="text-gray-600">
            Conecte suas contas do Instagram para sincronizar métricas e posts automaticamente.
          </p>
        </div>

        {/* Status da Integração */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-green-700 font-medium">Banco de Dados</p>
                <p className="text-xs text-green-600">8 tabelas criadas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4 flex items-center gap-3">
              <Zap className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-blue-700 font-medium">API tRPC</p>
                <p className="text-xs text-blue-600">Router ativo</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-sm text-orange-700 font-medium">Meta API</p>
                <p className="text-xs text-orange-600">Aguardando aprovação</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contas Conectadas */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Contas do Instagram</CardTitle>
            <Button
              size="sm"
              onClick={handleSeedData}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Inicializar Contas
            </Button>
          </CardHeader>
          <CardContent>
            {accountList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Instagram className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma conta configurada ainda.</p>
                <p className="text-sm">Clique em "Inicializar Contas" para adicionar as contas padrão.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {accountList.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-foreground font-bold">
                        {account.accountName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{account.accountName}</p>
                        <p className="text-sm text-muted-foreground">{account.accountHandle}</p>
                        {account.lastSync && (
                          <p className="text-xs text-muted-foreground">
                            Última sync: {new Date(account.lastSync).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={account.isActive ? "default" : "secondary"}
                        className={
                          account.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }
                      >
                        {account.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSync(account.id)}
                        disabled={syncing[account.id]}
                      >
                        <RefreshCw
                          className={`w-4 h-4 mr-1 ${syncing[account.id] ? "animate-spin" : ""}`}
                        />
                        Sincronizar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dados ao Vivo */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <LiveInstagramData />
          </CardContent>
        </Card>

        {/* Galeria de Posts Sincronizados */}
        <div className="mb-6">
          <InstagramPostsGallery />
        </div>

        {/* Histórico de Sincronizações */}
        <div className="mb-6">
          <InstagramSyncHistory />
        </div>

        {/* Configurações de Alerta */}
        <div className="mb-6">
          <InstagramEngagementSettings />
        </div>

        {/* Alertas Críticos por E-mail */}
        <div className="mb-6">
          <InstagramAlertEmailPanel />
        </div>

        {/* Reels Bar Chart + Top Engagement Post + Weekly Report */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InstagramReelsBarChart />
          <InstagramTopEngagementPost />
          <InstagramWeeklyReportPanel />
        </div>

        {/* Próximos Passos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Próximos Passos para Integração Real
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  step: 1,
                  color: "purple",
                  title: "Criar App no Meta for Developers",
                  desc: "Acesse developers.facebook.com e crie um app do tipo Business.",
                  link: "https://developers.facebook.com",
                },
                {
                  step: 2,
                  color: "blue",
                  title: "Configurar Permissões da API",
                  desc: "Solicitar: instagram_basic, instagram_manage_insights, pages_show_list.",
                },
                {
                  step: 3,
                  color: "green",
                  title: "Adicionar Credenciais ao Dashboard",
                  desc: "Após aprovação, adicionar App ID, App Secret e Access Token nas configurações.",
                },
                {
                  step: 4,
                  color: "orange",
                  title: "Ativar Sincronização Automática",
                  desc: "Job horário de sincronização será ativado automaticamente após configuração.",
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-6 h-6 rounded-full bg-${item.color}-100 text-${item.color}-700 flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                    {item.step}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 flex items-center gap-1 mt-1"
                      >
                        Abrir link <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
