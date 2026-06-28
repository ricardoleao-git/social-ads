import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Bell, Lock, User, Palette, Mail } from "lucide-react";
import { useLocation } from "wouter";

export default function Settings() {
  const [, setLocation] = useLocation();
  const [activeMenu, setActiveMenu] = useState("perfil");
  const [email, setEmail] = useState("ricardo@example.com");
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    daily: true,
    weekly: true,
  });
  const [theme, setTheme] = useState("light");

  const handleSaveSettings = () => {
    alert("Configurações salvas com sucesso!");
  };

  const handleChangePassword = () => {
    alert("Funcionalidade de alteração de senha será implementada em breve!");
  };

  const handleTwoFactor = () => {
    alert("Autenticação de dois fatores será implementada em breve!");
  };

  const handleActiveSessions = () => {
    alert("Gerenciador de sessões ativas será implementado em breve!");
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setLocation("/")}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
            <p className="text-gray-600">Gerencie suas preferências e notificações</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Card className="p-4 border-0 shadow-sm sticky top-6">
              <h3 className="font-bold text-gray-900 mb-3">Menu</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveMenu("perfil")}
                  className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    activeMenu === "perfil"
                      ? "bg-blue-100 text-blue-900 font-semibold"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <User className="w-4 h-4" />
                  Perfil
                </button>
                <button
                  onClick={() => setActiveMenu("notificacoes")}
                  className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    activeMenu === "notificacoes"
                      ? "bg-blue-100 text-blue-900 font-semibold"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  Notificações
                </button>
                <button
                  onClick={() => setActiveMenu("aparencia")}
                  className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    activeMenu === "aparencia"
                      ? "bg-blue-100 text-blue-900 font-semibold"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Palette className="w-4 h-4" />
                  Aparência
                </button>
                <button
                  onClick={() => setActiveMenu("seguranca")}
                  className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    activeMenu === "seguranca"
                      ? "bg-blue-100 text-blue-900 font-semibold"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  Segurança
                </button>
              </div>
            </Card>
          </div>

          <div className="md:col-span-2 space-y-4">
            {activeMenu === "perfil" && (
              <Card className="p-6 border-0 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-gray-900">Informações do Perfil</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Nome
                    </label>
                    <Input
                      type="text"
                      defaultValue="Ricardo Leão"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Telefone
                    </label>
                    <Input
                      type="tel"
                      defaultValue="+55 11 98765-4321"
                      className="w-full"
                    />
                  </div>

                  <Button
                    onClick={handleSaveSettings}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-foreground"
                  >
                    Salvar Alterações
                  </Button>
                </div>
              </Card>
            )}

            {activeMenu === "notificacoes" && (
              <Card className="p-6 border-0 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-gray-900">Notificações</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">Notificações por Email</p>
                      <p className="text-sm text-gray-600">Receba atualizações por email</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.email}
                      onChange={(e) =>
                        setNotifications({ ...notifications, email: e.target.checked })
                      }
                      className="w-5 h-5 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">Notificações Push</p>
                      <p className="text-sm text-gray-600">Receba notificações no navegador</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.push}
                      onChange={(e) =>
                        setNotifications({ ...notifications, push: e.target.checked })
                      }
                      className="w-5 h-5 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">Relatório Diário</p>
                      <p className="text-sm text-gray-600">Receba resumo diário de métricas</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.daily}
                      onChange={(e) =>
                        setNotifications({ ...notifications, daily: e.target.checked })
                      }
                      className="w-5 h-5 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">Relatório Semanal</p>
                      <p className="text-sm text-gray-600">Receba análise semanal completa</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.weekly}
                      onChange={(e) =>
                        setNotifications({ ...notifications, weekly: e.target.checked })
                      }
                      className="w-5 h-5 rounded"
                    />
                  </div>
                </div>
              </Card>
            )}

            {activeMenu === "aparencia" && (
              <Card className="p-6 border-0 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-gray-900">Aparência</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-3 block">
                      Tema
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
                      <button
                        onClick={() => setTheme("light")}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          theme === "light"
                            ? "border-blue-600 bg-blue-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="text-2xl mb-2">☀️</div>
                        <p className="text-sm font-semibold">Claro</p>
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          theme === "dark"
                            ? "border-blue-600 bg-blue-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="text-2xl mb-2">🌙</div>
                        <p className="text-sm font-semibold">Escuro</p>
                      </button>
                      <button
                        onClick={() => setTheme("auto")}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          theme === "auto"
                            ? "border-blue-600 bg-blue-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="text-2xl mb-2">🔄</div>
                        <p className="text-sm font-semibold">Auto</p>
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {activeMenu === "seguranca" && (
              <Card className="p-6 border-0 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-gray-900">Segurança</h3>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handleChangePassword}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    Alterar Senha
                  </Button>
                  <Button
                    onClick={handleTwoFactor}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    Ativar Autenticação de Dois Fatores
                  </Button>
                  <Button
                    onClick={handleActiveSessions}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    Ver Sessões Ativas
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
